import { getNode, moveNode, unwrapNode, wrapNode } from "../tree.js";
import type { CreateNodeOptions } from "../tree.js";
import type { DocumentStore } from "../document.js";
import type { Command } from "./types.js";

export class WrapNodeCommand implements Command {
  readonly name = "wrap";
  private wrapperId: string | null = null;

  constructor(
    private readonly id: string,
    private readonly wrapperType: string,
    private readonly options: CreateNodeOptions = {},
  ) {}

  get createdWrapperId(): string | null {
    return this.wrapperId;
  }

  execute(store: DocumentStore): void {
    const { document, wrapperId } = wrapNode(store.get(), this.id, this.wrapperType, this.options);
    this.wrapperId = wrapperId;
    store.set(document);
  }

  undo(store: DocumentStore): void {
    if (!this.wrapperId) return;
    store.set(unwrapNode(store.get(), this.wrapperId));
  }
}

export class UnwrapNodeCommand implements Command {
  readonly name = "unwrap";
  private wrapperType: string | null = null;
  private wrapperOptions: CreateNodeOptions = {};
  private childIds: string[] = [];

  constructor(private readonly id: string) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    this.wrapperType = node.type;
    this.wrapperOptions = { id: node.id, props: node.props, styles: node.styles, className: node.className, metadata: node.metadata, customData: node.customData };
    this.childIds = node.children.slice();
    store.set(unwrapNode(document, this.id));
  }

  undo(store: DocumentStore): void {
    if (!this.wrapperType || this.childIds.length === 0) return;
    let document = store.get();
    const firstChild = getNode(document, this.childIds[0]!);
    const parentId = firstChild.parent;
    if (!parentId) return;
    const { document: wrapped, wrapperId } = wrapNode(document, this.childIds[0]!, this.wrapperType, this.wrapperOptions);
    document = wrapped;
    this.childIds.slice(1).forEach((childId, offset) => {
      document = moveNode(document, childId, wrapperId, { index: offset + 1 });
    });
    store.set(document);
  }
}
