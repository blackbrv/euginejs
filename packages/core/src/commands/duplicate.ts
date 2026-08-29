import { captureSubtree, cloneSubtreeSnapshot, getNode, hasNode, removeNode, restoreSubtree } from "../tree.js";
import type { IdFactory } from "../tree.js";
import { invalidDrop } from "../errors.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

/** Deep-copies a node subtree with fresh ids and inserts the copy next to the original. */
export class DuplicateNodeCommand implements Command {
  readonly name = "duplicate";
  private clone: { rootId: string; nodes: Record<string, EugineNode> } | null = null;
  private parentId: string | null = null;
  private index = 0;

  constructor(
    private readonly id: string,
    private readonly idFactory?: IdFactory,
  ) {}

  /** The id of the newly created copy, available after execute() has run. */
  get duplicatedId(): string | null {
    return this.clone?.rootId ?? null;
  }

  execute(store: DocumentStore): void {
    const document = store.get();
    const node = getNode(document, this.id);
    const parentId = node.parent;
    if (!parentId) {
      throw invalidDrop("The root node cannot be duplicated.", { id: this.id });
    }
    const parent = getNode(document, parentId);
    this.parentId = parentId;
    this.index = parent.children.indexOf(this.id) + 1;

    // Clone once and reuse it. Re-cloning on every execute would mint new ids
    // on each redo, so `duplicatedId` — and anything the host kept hold of
    // from it, a selection or a follow-up edit — would dangle after the first
    // undo/redo cycle. It also gives the operation stable ids to transmit.
    if (!this.clone) {
      this.clone = cloneSubtreeSnapshot(captureSubtree(document, this.id), this.id, this.idFactory);
    }

    store.set(
      restoreSubtree(document, this.clone.nodes, this.clone.rootId, parentId, {
        index: this.index,
        overwriteExisting: false,
      }),
    );
  }

  undo(store: DocumentStore): void {
    if (!this.clone) return;
    const document = store.get();
    if (!hasNode(document, this.clone.rootId)) return;
    store.set(removeNode(document, this.clone.rootId));
  }

  toOperation(): EugineOperation | null {
    if (!this.clone || !this.parentId) return null;
    return {
      type: "attach",
      nodes: this.clone.nodes,
      rootId: this.clone.rootId,
      parentId: this.parentId,
      index: this.index,
    };
  }
}
