import { getNode, hasNode, moveNode, unwrapNode, wrapNode } from "../tree.js";
import type { CreateNodeOptions, IdFactory } from "../tree.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

export class WrapNodeCommand implements Command {
  readonly name = "wrap";
  private wrapperId: string | null = null;
  private undone: EugineOperation[] = [];

  constructor(
    private readonly id: string,
    private readonly wrapperType: string,
    private readonly options: CreateNodeOptions = {},
    private readonly idFactory?: IdFactory,
  ) {}

  get createdWrapperId(): string | null {
    return this.wrapperId;
  }

  execute(store: DocumentStore): void {
    // Reuse the id minted on the first execute, so a redo rebuilds the *same*
    // wrapper node rather than a new one the host holds no reference to.
    const options = this.wrapperId ? { ...this.options, id: this.wrapperId } : this.options;
    const { document, wrapperId } = wrapNode(store.get(), this.id, this.wrapperType, options, this.idFactory);
    this.wrapperId = wrapperId;
    store.set(document);
  }

  undo(store: DocumentStore): void {
    this.undone = [];
    if (!this.wrapperId) return;
    const document = store.get();
    if (!hasNode(document, this.wrapperId)) return;
    store.set(unwrapNode(document, this.wrapperId));
    this.undone = [{ type: "unwrap", id: this.wrapperId }];
  }

  toOperation(): EugineOperation | null {
    if (!this.wrapperId) return null;
    return {
      type: "wrap",
      id: this.id,
      wrapperId: this.wrapperId,
      wrapperType: this.wrapperType,
      wrapper: this.options,
    };
  }

  toUndoOperations(): EugineOperation[] {
    return this.undone;
  }
}

export class UnwrapNodeCommand implements Command {
  readonly name = "unwrap";
  private wrapperType: string | null = null;
  private wrapperOptions: CreateNodeOptions = {};
  private childIds: string[] = [];
  private undone: EugineOperation[] = [];

  constructor(
    private readonly id: string,
    private readonly idFactory?: IdFactory,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    this.wrapperType = node.type;
    // Carrying the original id means undo restores the same wrapper node,
    // which keeps redo and any remote replay deterministic.
    this.wrapperOptions = {
      id: node.id,
      props: node.props,
      styles: node.styles,
      className: node.className,
      metadata: node.metadata,
      customData: node.customData,
    };
    this.childIds = node.children.slice();
    store.set(unwrapNode(document, this.id));
  }

  undo(store: DocumentStore): void {
    this.undone = [];
    if (!this.wrapperType) return;
    let document = store.get();

    // Rewrap whichever children still exist; another client may have deleted
    // some of them since. If they are all gone there is nothing to wrap.
    const surviving = this.childIds.filter((childId) => hasNode(document, childId));
    const first = surviving[0];
    if (first === undefined) return;

    const parentId = getNode(document, first).parent;
    if (!parentId) return;

    const { document: wrapped, wrapperId } = wrapNode(
      document,
      first,
      this.wrapperType,
      this.wrapperOptions,
      this.idFactory,
    );
    document = wrapped;
    const { id: _id, ...wrapper } = this.wrapperOptions;
    const undone: EugineOperation[] = [
      { type: "wrap", id: first, wrapperId, wrapperType: this.wrapperType, wrapper },
    ];
    surviving.slice(1).forEach((childId, offset) => {
      document = moveNode(document, childId, wrapperId, { index: offset + 1 });
      undone.push({ type: "move", id: childId, parentId: wrapperId, index: offset + 1 });
    });
    store.set(document);
    this.undone = undone;
  }

  toOperation(): EugineOperation {
    return { type: "unwrap", id: this.id };
  }

  toUndoOperations(): EugineOperation[] {
    return this.undone;
  }
}
