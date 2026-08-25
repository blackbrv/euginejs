import { insertNode, removeNode } from "../tree.js";
import type { EugineNode } from "../types.js";
import type { DocumentStore } from "../document.js";
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
    store.set(removeNode(store.get(), this.node.id));
  }
}
