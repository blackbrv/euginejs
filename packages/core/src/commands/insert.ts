import { hasNode, insertNode, removeNode } from "../tree.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

export class InsertNodeCommand implements Command {
  readonly name = "insert";

  constructor(
    private readonly node: EugineNode,
    private readonly parentId: string,
    private readonly index?: number,
  ) {}

  execute(store: DocumentStore): void {
    store.set(insertNode(store.get(), this.node, this.parentId, this.index));
  }

  undo(store: DocumentStore): void {
    const document = store.get();
    // Another client already removed it. Nothing left to undo.
    if (!hasNode(document, this.node.id)) return;
    store.set(removeNode(document, this.node.id));
  }

  toOperation(): EugineOperation {
    return { type: "insert", node: this.node, parentId: this.parentId, index: this.index };
  }
}
