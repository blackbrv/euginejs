import { getNode, reorderChildren } from "../tree.js";
import type { DocumentStore } from "../document.js";
import type { Command } from "./types.js";

export class ReorderChildrenCommand implements Command {
  readonly name = "reorder";
  private previousOrder: string[] = [];

  constructor(
    private readonly parentId: string,
    private readonly orderedChildIds: string[],
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.previousOrder = getNode(document, this.parentId).children.slice();
    store.set(reorderChildren(document, this.parentId, this.orderedChildIds));
  }

  undo(store: DocumentStore): void {
    store.set(reorderChildren(store.get(), this.parentId, this.previousOrder));
  }
}
