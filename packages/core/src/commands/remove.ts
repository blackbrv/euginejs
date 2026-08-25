import { invalidDrop } from "../errors.js";
import { captureSubtree, getNode, removeNode, restoreSubtree } from "../tree.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { Command } from "./types.js";

export class RemoveNodeCommand implements Command {
  readonly name = "remove";
  private snapshot: Record<string, EugineNode> | null = null;
  private parentId: string | null = null;
  private index = 0;

  constructor(private readonly id: string) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    if (node.locked) {
      throw invalidDrop(`Node "${this.id}" is locked and cannot be removed.`, { id: this.id });
    }
    const parent = node.parent ? getNode(document, node.parent) : null;
    this.snapshot = captureSubtree(document, this.id);
    this.parentId = parent?.id ?? null;
    this.index = parent ? parent.children.indexOf(this.id) : 0;
    store.set(removeNode(document, this.id));
  }

  undo(store: DocumentStore): void {
    if (!this.snapshot || !this.parentId) return;
    store.set(restoreSubtree(store.get(), this.snapshot, this.id, this.parentId, this.index));
  }
}
