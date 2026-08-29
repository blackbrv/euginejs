import { hasNode, removeNode, restoreSubtree } from "../tree.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

/**
 * Attaches an already fresh-id-cloned subtree (see cloneSubtreeSnapshot) into
 * the document under `parentId`. Pairs with RemoveNodeCommand's undo shape:
 * execute attaches, undo detaches — the same restoreSubtree/removeNode pair
 * used elsewhere in the codebase for exactly this kind of operation.
 */
export class PasteSubtreeCommand implements Command {
  readonly name = "paste";

  constructor(
    private readonly nodes: Record<string, EugineNode>,
    private readonly rootId: string,
    private readonly parentId: string,
    private readonly index?: number,
  ) {}

  execute(store: DocumentStore): void {
    store.set(
      restoreSubtree(store.get(), this.nodes, this.rootId, this.parentId, {
        index: this.index,
        overwriteExisting: false,
      }),
    );
  }

  undo(store: DocumentStore): void {
    const document = store.get();
    if (!hasNode(document, this.rootId)) return;
    store.set(removeNode(document, this.rootId));
  }

  toOperation(): EugineOperation {
    return { type: "attach", nodes: this.nodes, rootId: this.rootId, parentId: this.parentId, index: this.index };
  }
}
