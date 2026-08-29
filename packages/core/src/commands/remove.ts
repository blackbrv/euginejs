import { invalidDrop } from "../errors.js";
import { captureSubtree, getNode, hasNode, removeNode, restoreSubtree } from "../tree.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
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
    const document = store.get();

    // Another client re-created this id since. Leave their version alone.
    if (hasNode(document, this.id)) return;

    // The original parent may itself have been deleted in the meantime.
    // Restoring under the root keeps the subtree — losing the user's content
    // entirely because its container is gone would be the worse failure.
    const parentExists = hasNode(document, this.parentId);
    const parentId = parentExists ? this.parentId : document.rootId;

    store.set(
      restoreSubtree(document, this.snapshot, this.id, parentId, {
        index: parentExists ? this.index : undefined,
        // Restore only what is genuinely missing: any node in the snapshot
        // that is live again belongs to whoever put it there.
        overwriteExisting: false,
      }),
    );
  }

  toOperation(): EugineOperation {
    return { type: "remove", id: this.id };
  }
}
