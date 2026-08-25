import { invalidDrop } from "../errors.js";
import { getNode, moveNode } from "../tree.js";
import type { DocumentStore } from "../document.js";
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
    store.set(moveNode(store.get(), this.id, this.previousParentId, { index: this.previousIndex }));
  }
}
