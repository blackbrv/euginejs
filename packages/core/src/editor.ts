import type { Command } from "./commands/types.js";
import {
  DuplicateNodeCommand,
  InsertNodeCommand,
  MoveNodeCommand,
  ReorderChildrenCommand,
  ReplaceNodeCommand,
  RemoveNodeCommand,
  UnwrapNodeCommand,
  UpdatePropsCommand,
  UpdateStylesCommand,
  WrapNodeCommand,
} from "./commands/index.js";
import { DocumentStore } from "./document.js";
import { EventBus } from "./events.js";
import { History, type Transaction } from "./history.js";
import { createId } from "./id.js";
import { EuginePlugin, PluginManager } from "./plugin.js";
import { ComponentRegistry } from "./registry.js";
import { Selection } from "./selection.js";
import { LoadDocumentOptions, MigrationRegistry, loadDocument, serializeDocument } from "./serialization.js";
import { StorageManager } from "./storage.js";
import { createEmptyDocument, getNode, type CreateNodeOptions } from "./tree.js";
import type {
  ComponentDefinition,
  EugineDocument,
  EugineNode,
  NodeProps,
  NodeStyles,
  SerializedDocument,
} from "./types.js";

export interface EditorEventMap {
  "editor.ready": Record<string, never>;
  "editor.destroy": Record<string, never>;
  "document.change": { document: EugineDocument; previous: EugineDocument };
  "document.load": { document: EugineDocument };
  "node.create": { node: EugineNode };
  "node.delete": { id: string };
  "node.move": { id: string; parentId: string };
  "node.select": { ids: string[] };
  "node.update": { id: string };
  "history.undo": { transaction: Transaction };
  "history.redo": { transaction: Transaction };
  "component.register": { type: string };
  "component.unregister": { type: string };
}

export interface InsertOptions extends Omit<CreateNodeOptions, "children"> {
  index?: number;
}

export interface CreateEditorOptions {
  /** Component definitions registered up-front, keyed conceptually by type. */
  components?: ComponentDefinition[];
  /** An existing document (raw or in its serialized envelope) to start from. */
  document?: EugineDocument | SerializedDocument;
  migrations?: MigrationRegistry;
  plugins?: EuginePlugin<Editor>[];
}

function isSerializedDocument(value: EugineDocument | SerializedDocument): value is SerializedDocument {
  return "engine" in value;
}

/**
 * The editor facade: wires together the document store, component registry,
 * command/history system, selection state and plugin runtime described in
 * the PRD. This is the "engine" — hosts build their own UI around it.
 */
export class Editor {
  readonly registry = new ComponentRegistry();
  readonly store: DocumentStore;
  readonly history: History;
  readonly selection = new Selection();
  readonly events = new EventBus<EditorEventMap>();
  readonly storage = new StorageManager();
  readonly migrations: MigrationRegistry;
  private readonly plugins: PluginManager<Editor>;
  private readonly disposers: Array<() => void> = [];

  constructor(options: CreateEditorOptions = {}) {
    this.migrations = options.migrations ?? new MigrationRegistry();

    for (const definition of options.components ?? []) {
      this.registry.register(definition);
    }

    const initialDocument = this.resolveInitialDocument(options);
    // The document's root node is an implicit container: unless the host
    // explicitly registered a component for its type, treat it as accepting
    // any child so createEditor() works out of the box with no boilerplate.
    const rootType = initialDocument.nodes[initialDocument.rootId]?.type;
    if (rootType && !this.registry.has(rootType)) {
      this.registry.registerOrReplace({ type: rootType, label: "Root", accepts: "*" });
    }

    this.store = new DocumentStore(initialDocument);
    this.history = new History(this.store);
    this.plugins = new PluginManager(this);

    this.disposers.push(
      this.store.onChange(({ document, previous }) => {
        // Any node that no longer exists (removed directly, removed as part
        // of an ancestor's subtree, unwrapped, etc.) must not linger in
        // selection — otherwise a document.change listener that looks up
        // the current selection (e.g. to render a property panel) can
        // observe a selected id that getNode() will throw on. Pruning here,
        // before re-emitting "document.change", guarantees selection is
        // already consistent with the document by the time any listener
        // (including the host's own) sees the change.
        const stale = this.selection.get().filter((id) => !document.nodes[id]);
        if (stale.length > 0) this.selection.deselect(stale);
        this.events.emit("document.change", { document, previous });
      }),
      this.history.events.on("undo", (payload) => this.events.emit("history.undo", payload)),
      this.history.events.on("redo", (payload) => this.events.emit("history.redo", payload)),
    );

    for (const plugin of options.plugins ?? []) this.use(plugin);

    this.plugins.markReady();
    this.events.emit("editor.ready", {});
  }

  private resolveInitialDocument(options: CreateEditorOptions): EugineDocument {
    if (!options.document) return createEmptyDocument();
    return isSerializedDocument(options.document)
      ? loadDocument(options.document, { migrations: this.migrations })
      : options.document;
  }

  getDocument(): EugineDocument {
    return this.store.get();
  }

  getNode(id: string): EugineNode {
    return getNode(this.store.get(), id);
  }

  // --- Component registry -------------------------------------------------

  registerComponent(definition: ComponentDefinition): void {
    this.registry.register(definition);
    this.events.emit("component.register", { type: definition.type });
  }

  unregisterComponent(type: string): void {
    this.registry.unregister(type);
    this.events.emit("component.unregister", { type });
  }

  // --- Document mutation commands -----------------------------------------

  insert(type: string, parentId: string, options: InsertOptions = {}): string {
    const document = this.store.get();
    const parent = getNode(document, parentId);
    const definition = this.registry.get(type);

    this.registry.assertCanAcceptChild({
      parentType: parent.type,
      childType: type,
      currentChildCount: parent.children.length,
    });

    const node: EugineNode = {
      id: options.id ?? createId("node"),
      type,
      props: { ...definition.defaults?.props, ...options.props },
      styles: { ...definition.defaults?.styles, ...options.styles },
      className: options.className,
      children: [],
      parent: null,
      metadata: options.metadata,
      customData: options.customData,
      locked: options.locked,
      editable: options.editable,
      hidden: options.hidden,
    };

    this.history.execute(new InsertNodeCommand(node, parentId, options.index));
    this.events.emit("node.create", { node });
    return node.id;
  }

  remove(id: string): void {
    // Selection cleanup for `id` and any removed descendants is handled
    // generically by the store.onChange listener registered in the
    // constructor, which prunes any selected id no longer present in the
    // document as soon as it changes.
    this.history.execute(new RemoveNodeCommand(id));
    this.events.emit("node.delete", { id });
  }

  move(id: string, parentId: string, index?: number): void {
    const document = this.store.get();
    const node = getNode(document, id);
    const parent = getNode(document, parentId);
    this.registry.assertCanAcceptChild({
      parentType: parent.type,
      childType: node.type,
      currentChildCount: parent.id === node.parent ? parent.children.length - 1 : parent.children.length,
    });
    this.history.execute(new MoveNodeCommand(id, parentId, index));
    this.events.emit("node.move", { id, parentId });
  }

  duplicate(id: string): string {
    const command = new DuplicateNodeCommand(id);
    this.history.execute(command);
    const newId = command.duplicatedId;
    if (newId) this.events.emit("node.create", { node: this.getNode(newId) });
    return newId ?? id;
  }

  updateProps(id: string, props: NodeProps, options: { merge?: boolean } = {}): void {
    this.history.execute(new UpdatePropsCommand(id, props, options.merge ?? true));
    this.events.emit("node.update", { id });
  }

  updateStyles(id: string, styles: NodeStyles, options: { merge?: boolean } = {}): void {
    this.history.execute(new UpdateStylesCommand(id, styles, options.merge ?? true));
    this.events.emit("node.update", { id });
  }

  replace(id: string, next: EugineNode): void {
    this.history.execute(new ReplaceNodeCommand(id, next));
    this.events.emit("node.update", { id });
  }

  reorder(parentId: string, orderedChildIds: string[]): void {
    this.history.execute(new ReorderChildrenCommand(parentId, orderedChildIds));
    this.events.emit("node.update", { id: parentId });
  }

  wrap(id: string, wrapperType: string, options: CreateNodeOptions = {}): string {
    const command = new WrapNodeCommand(id, wrapperType, options);
    this.history.execute(command);
    return command.createdWrapperId ?? id;
  }

  unwrap(id: string): void {
    this.history.execute(new UnwrapNodeCommand(id));
  }

  /** Groups every command run inside `fn` into a single history transaction. */
  transaction<T>(fn: () => T, label?: string): T {
    return this.history.transaction(fn, label);
  }

  runCommand(command: Command): void {
    this.history.execute(command);
  }

  // --- Serialization --------------------------------------------------------

  serialize(): SerializedDocument {
    return serializeDocument(this.store.get());
  }

  load(serialized: SerializedDocument, options: LoadDocumentOptions = {}): void {
    const document = loadDocument(serialized, { migrations: options.migrations ?? this.migrations });
    this.store.set(document);
    this.history.clear();
    this.selection.clear();
    this.events.emit("document.load", { document });
  }

  // --- Plugins ----------------------------------------------------------------

  use(plugin: EuginePlugin<Editor>): void {
    this.plugins.use(plugin);
  }

  destroy(): void {
    this.plugins.destroy();
    for (const dispose of this.disposers) dispose();
    this.events.emit("editor.destroy", {});
    this.events.clear();
  }
}

export function createEditor(options?: CreateEditorOptions): Editor {
  return new Editor(options);
}
