import type { Command } from "./commands/types.js";
import {
  DuplicateNodeCommand,
  InsertNodeCommand,
  MoveNodeCommand,
  PasteSubtreeCommand,
  ReorderChildrenCommand,
  ReplaceNodeCommand,
  RemoveNodeCommand,
  UnwrapNodeCommand,
  UpdatePropsCommand,
  UpdateStylesCommand,
  WrapNodeCommand,
} from "./commands/index.js";
import { DocumentStore, type ChangeOrigin } from "./document.js";
import { EugineError } from "./errors.js";
import { EventBus } from "./events.js";
import { History, type Transaction } from "./history.js";
import { createId } from "./id.js";
import { applyOperations, type EugineOperation, type OperationConflictPolicy } from "./operations.js";
import { EuginePlugin, PluginManager } from "./plugin.js";
import { ComponentRegistry } from "./registry.js";
import { Selection } from "./selection.js";
import { LoadDocumentOptions, MigrationRegistry, isSerializedDocument, loadDocument, serializeDocument } from "./serialization.js";
import { StorageManager, type SaveOptions, type SaveResult } from "./storage.js";
import {
  captureSubtree,
  cloneSubtreeSnapshot,
  createEmptyDocument,
  getNode,
  hasNode,
  type CreateNodeOptions,
  type IdFactory,
  type SubtreeSnapshot,
} from "./tree.js";
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
  "document.change": { document: EugineDocument; previous: EugineDocument; origin?: ChangeOrigin };
  "document.load": { document: EugineDocument };
  /** Operations from another client were applied — see Editor.applyRemote(). */
  "document.remote": { applied: EugineOperation[]; dropped: EugineOperation[] };
  "node.create": { node: EugineNode };
  "node.delete": { id: string };
  "node.move": { id: string; parentId: string };
  "node.select": { ids: string[]; previous: string[] };
  "node.update": { id: string };
  "history.undo": { transaction: Transaction };
  "history.redo": { transaction: Transaction };
  "component.register": { type: string };
  "component.unregister": { type: string };
}

export interface InsertOptions extends Omit<CreateNodeOptions, "children"> {
  index?: number;
}

export interface ApplyRemoteOptions {
  /** The client the operations came from, reported on the resulting change. */
  clientId?: string;
  /**
   * What to do with an operation whose target no longer exists. Defaults to
   * `"drop"`: a remote op arriving for a node this client already deleted is
   * a normal race, not an error, and throwing would take down the sync loop
   * along with everything queued behind it.
   */
  policy?: OperationConflictPolicy;
}

export interface ApplyRemoteResult {
  applied: EugineOperation[];
  dropped: EugineOperation[];
}

export interface CreateEditorOptions {
  /** Component definitions registered up-front, keyed conceptually by type. */
  components?: ComponentDefinition[];
  /** An existing document (raw or in its serialized envelope) to start from. */
  document?: EugineDocument | SerializedDocument;
  migrations?: MigrationRegistry;
  plugins?: EuginePlugin<Editor>[];
  /**
   * Identifies this client in a shared session. Transactions are tagged with
   * it, and undo/redo then skip anything authored elsewhere — so Ctrl+Z never
   * reverts a colleague's edit.
   */
  clientId?: string;
  /**
   * Mints ids for newly created nodes. Supply a client-scoped factory in a
   * collaborative session rather than trusting two browsers' independent
   * `Math.random()` never to collide — a duplicate id makes `insertNode()`
   * throw, which is a hard failure in the sync loop.
   */
  idFactory?: IdFactory;
  /**
   * Overrides the default document nesting-depth limit enforced on every
   * mutation (see ValidateDocumentOptions.maxDepth) — for a host whose
   * documents are legitimately deeper than the default. Applies to the
   * initial document and every subsequent store write.
   */
  maxDepth?: number;
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
  /** Identifies this client in a shared session, if one was configured. */
  readonly clientId: string | undefined;
  private readonly idFactory: IdFactory;
  private readonly plugins: PluginManager<Editor>;
  private readonly disposers: Array<() => void> = [];
  private readonly maxDepth: number | undefined;

  constructor(options: CreateEditorOptions = {}) {
    this.migrations = options.migrations ?? new MigrationRegistry();
    this.clientId = options.clientId;
    this.idFactory = options.idFactory ?? (() => createId("node"));
    this.maxDepth = options.maxDepth;

    for (const definition of options.components ?? []) {
      this.registry.register(definition);
    }

    const initialDocument = this.resolveInitialDocument(options);
    // The document's root node is an implicit container: unless the host
    // explicitly registered a component for its type, treat it as accepting
    // any child so createEditor() works out of the box with no boilerplate.
    const rootType = hasNode(initialDocument, initialDocument.rootId)
      ? getNode(initialDocument, initialDocument.rootId).type
      : undefined;
    if (rootType && !this.registry.has(rootType)) {
      this.registry.registerOrReplace({ type: rootType, label: "Root", accepts: "*" });
    }

    this.store = new DocumentStore(initialDocument, { maxDepth: options.maxDepth });
    this.history = new History(this.store, { clientId: options.clientId });
    this.plugins = new PluginManager(this);

    this.disposers.push(
      this.store.onChange(({ document, previous, origin }) => {
        // Any node that no longer exists (removed directly, removed as part
        // of an ancestor's subtree, unwrapped, etc.) must not linger in
        // selection — otherwise a document.change listener that looks up
        // the current selection (e.g. to render a property panel) can
        // observe a selected id that getNode() will throw on. Pruning here,
        // before re-emitting "document.change", guarantees selection is
        // already consistent with the document by the time any listener
        // (including the host's own) sees the change.
        const stale = this.selection.get().filter((id) => !hasNode(document, id));
        if (stale.length > 0) this.selection.deselect(stale);
        this.events.emit("document.change", { document, previous, origin });
      }),
      // Selection changes are what a presence layer subscribes to in order to
      // show "Sarah is editing this heading". The event was declared on
      // EditorEventMap but nothing ever emitted it, so anyone who wired it up
      // got silence — with full autocomplete, which made it worse.
      this.selection.onSelectionChange(({ ids, previous }) => {
        this.events.emit("node.select", { ids, previous });
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
      ? loadDocument(options.document, { migrations: this.migrations, maxDepth: options.maxDepth })
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
      id: options.id ?? this.idFactory(),
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
    const command = new DuplicateNodeCommand(id, this.idFactory);
    this.history.execute(command);
    const newId = command.duplicatedId;
    if (newId) this.events.emit("node.create", { node: this.getNode(newId) });
    return newId ?? id;
  }

  /**
   * Captures `id` and its subtree as a self-contained snapshot — detached
   * from the live document, so it's safe to hold onto (in an app-level
   * clipboard, for example) even after further edits, undo, or the
   * original node being removed. Pair with pasteSubtree().
   */
  copySubtree(id: string): SubtreeSnapshot {
    return { rootId: id, nodes: captureSubtree(this.store.get(), id) };
  }

  /**
   * Attaches a fresh, uniquely-id'd clone of `snapshot` (from copySubtree())
   * under `parentId`. Safe to call any number of times with the same
   * snapshot — every paste gets its own new ids, so nothing collides with
   * the original or with earlier pastes. One undo step.
   */
  pasteSubtree(snapshot: SubtreeSnapshot, parentId: string, index?: number): string {
    const clone = cloneSubtreeSnapshot(snapshot.nodes, snapshot.rootId, this.idFactory);
    this.history.execute(new PasteSubtreeCommand(clone.nodes, clone.rootId, parentId, index));
    this.events.emit("node.create", { node: this.getNode(clone.rootId) });
    return clone.rootId;
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
    const command = new WrapNodeCommand(id, wrapperType, options, this.idFactory);
    this.history.execute(command);
    return command.createdWrapperId ?? id;
  }

  unwrap(id: string): void {
    this.history.execute(new UnwrapNodeCommand(id, this.idFactory));
  }

  /** Groups every command run inside `fn` into a single history transaction. */
  transaction<T>(fn: () => T, label?: string): T {
    return this.history.transaction(fn, label);
  }

  runCommand(command: Command): void {
    this.history.execute(command);
  }

  // --- Collaboration --------------------------------------------------------

  /**
   * Applies operations authored by another client.
   *
   * Deliberately bypasses history: a remote edit must never land on this
   * user's undo stack, or their next Ctrl+Z reverts someone else's work. It
   * also never throws by default — a remote op arriving for a node this client
   * already deleted is an ordinary race, and (like a batch that would exceed
   * the max nesting depth) aborting would take the sync loop down with it.
   * Dropped operations are returned so the host can decide whether they matter.
   */
  applyRemote(operations: readonly EugineOperation[], options: ApplyRemoteOptions = {}): ApplyRemoteResult {
    let { applied, dropped, document } = applyOperations(this.store.get(), operations, {
      policy: options.policy ?? "drop",
    });

    if (applied.length > 0) {
      const origin: ChangeOrigin = { clientId: options.clientId, remote: true };
      try {
        this.store.set(document, { origin });
      } catch (error) {
        // applyOperations does not enforce maxDepth itself; store.set validates
        // the merged document and throws EUGINE_DOCUMENT_INVALID if the remote
        // batch would push it past the nesting limit. That is a sync-loop
        // concern, not a local editing error — drop the whole batch rather than
        // crashing the loop, consistent with how a vanished target is dropped.
        if (error instanceof EugineError && error.code === "EUGINE_DOCUMENT_INVALID") {
          dropped = dropped.concat(applied);
          applied = [];
        } else {
          throw error;
        }
      }
    }

    this.events.emit("document.remote", { applied, dropped });
    return { applied, dropped };
  }

  // --- Serialization --------------------------------------------------------

  serialize(): SerializedDocument {
    return serializeDocument(this.store.get(), { maxDepth: this.maxDepth });
  }

  /**
   * Serializes and persists through the configured storage adapter, tagging
   * the write with the revision it was based on so the adapter can reject it
   * if the stored document has moved on.
   *
   * Prefer this over `editor.storage.save(editor.serialize())` — forgetting
   * the baseRevision is what makes two clients editing one page silently
   * last-write-wins.
   */
  async save(options: Omit<SaveOptions, "baseRevision"> = {}): Promise<SaveResult> {
    return await this.storage.save(this.serialize(), {
      ...options,
      baseRevision: this.store.getRevision(),
    });
  }

  load(serialized: SerializedDocument, options: LoadDocumentOptions = {}): void {
    const document = loadDocument(serialized, {
      migrations: options.migrations ?? this.migrations,
      maxDepth: options.maxDepth ?? this.maxDepth,
    });
    // Keep the revision the document arrived with: bumping it here would make
    // this client's very first save look like it was based on a revision the
    // server has never seen. loadDocument() above already validated the
    // document (including any maxDepth override), so skip the redundant second
    // validation that store.set() would otherwise run.
    this.store.set(document, { bumpRevision: false, validate: false });
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
