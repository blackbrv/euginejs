import { getNode, replaceNode, updateNodeProps, updateNodeStyles } from "../tree.js";
import type { EugineNode, NodeProps, NodeStyles } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { Command } from "./types.js";

export class UpdatePropsCommand implements Command {
  readonly name = "updateProps";
  private previous: NodeProps | null = null;

  constructor(
    private readonly id: string,
    private readonly props: NodeProps,
    private readonly merge = true,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.previous = getNode(document, this.id).props;
    store.set(updateNodeProps(document, this.id, this.props, { merge: this.merge }));
  }

  undo(store: DocumentStore): void {
    if (!this.previous) return;
    store.set(updateNodeProps(store.get(), this.id, this.previous, { merge: false }));
  }
}

export class UpdateStylesCommand implements Command {
  readonly name = "updateStyles";
  private previous: NodeStyles | undefined;

  constructor(
    private readonly id: string,
    private readonly styles: NodeStyles,
    private readonly merge = true,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.previous = getNode(document, this.id).styles ?? {};
    store.set(updateNodeStyles(document, this.id, this.styles, { merge: this.merge }));
  }

  undo(store: DocumentStore): void {
    store.set(updateNodeStyles(store.get(), this.id, this.previous ?? {}, { merge: false }));
  }
}

export class ReplaceNodeCommand implements Command {
  readonly name = "replace";
  private previous: EugineNode | null = null;

  constructor(
    private readonly id: string,
    private readonly next: EugineNode,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.previous = getNode(document, this.id);
    store.set(replaceNode(document, this.id, this.next));
  }

  undo(store: DocumentStore): void {
    if (!this.previous) return;
    store.set(replaceNode(store.get(), this.id, this.previous));
  }
}
