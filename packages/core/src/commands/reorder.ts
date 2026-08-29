import { getNode, hasNode, reorderChildren } from "../tree.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
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
    const document = store.get();
    if (!hasNode(document, this.parentId)) return;

    // Non-strict: between the reorder and this undo another client may have
    // added or removed a child, and the recorded order no longer describes
    // the live set. Strict mode would throw here — which, mid-transaction,
    // leaves the document half-reverted. Reconciling always succeeds.
    store.set(reorderChildren(document, this.parentId, this.previousOrder, { strict: false }));
  }

  toOperation(): EugineOperation {
    return { type: "reorder", parentId: this.parentId, order: this.orderedChildIds };
  }
}
