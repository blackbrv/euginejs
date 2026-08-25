import { getNode, insertNode, removeNode, duplicateSubtree } from "../tree.js";
import { invalidDrop } from "../errors.js";
import type { DocumentStore } from "../document.js";
import type { Command } from "./types.js";

/** Deep-copies a node subtree with fresh ids and inserts the copy next to the original. */
export class DuplicateNodeCommand implements Command {
  readonly name = "duplicate";
  private newId: string | null = null;

  constructor(private readonly id: string) {}

  /** The id of the newly created copy, available after execute() has run. */
  get duplicatedId(): string | null {
    return this.newId;
  }

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    const parentId = node.parent;
    if (!parentId) {
      throw invalidDrop("The root node cannot be duplicated.", { id: this.id });
    }
    const parent = getNode(document, parentId);
    const index = parent.children.indexOf(this.id) + 1;

    const { document: cloned, newId } = duplicateSubtree(document, this.id);
    this.newId = newId;
    store.set(insertNode(cloned, getNode(cloned, newId), parentId, index));
  }

  undo(store: DocumentStore): void {
    if (!this.newId) return;
    store.set(removeNode(store.get(), this.newId));
  }
}
