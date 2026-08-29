import { invalidDrop } from "../errors.js";
import { getNode, hasNode, moveNode } from "../tree.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

export class MoveNodeCommand implements Command {
  readonly name = "move";
  private previousParentId: string | null = null;
  private previousIndex = 0;

  constructor(
    private readonly id: string,
    private readonly newParentId: string,
    private readonly index?: number,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    if (node.locked) {
      throw invalidDrop(`Node "${this.id}" is locked and cannot be moved.`, { id: this.id });
    }
    const parent = node.parent ? getNode(document, node.parent) : null;
    this.previousParentId = parent?.id ?? null;
    this.previousIndex = parent ? parent.children.indexOf(this.id) : 0;
    store.set(moveNode(document, this.id, this.newParentId, { index: this.index }));
  }

  undo(store: DocumentStore): void {
    if (!this.previousParentId) return;
    const document = store.get();

    // Another client removed the node entirely — there is nothing to move back.
    if (!hasNode(document, this.id)) return;

    // ...or removed where it came from. Return it to the root rather than
    // throwing and stranding the rest of the transaction half-undone.
    const parentId = hasNode(document, this.previousParentId) ? this.previousParentId : document.rootId;

    // moveNode clamps the index to the parent's current child count, so an
    // index recorded before a sibling was removed still lands sensibly.
    store.set(moveNode(document, this.id, parentId, { index: this.previousIndex }));
  }

  toOperation(): EugineOperation {
    return { type: "move", id: this.id, parentId: this.newParentId, index: this.index };
  }
}
