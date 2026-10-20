import { getNode, hasNode, invertPatch, replaceNode, updateNodeProps, updateNodeStyles } from "../tree.js";
import type { EugineNode, NodeProps, NodeStyles } from "../types.js";
import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";
import type { Command } from "./types.js";

interface InversePatch {
  patch: Record<string, unknown>;
  unset: string[];
}

/**
 * Undoes a props/styles write by restoring exactly the keys the write touched
 * and unsetting exactly the keys it introduced — never by putting back a whole
 * captured object.
 *
 * The difference matters as soon as a second person is editing. Restoring a
 * snapshot of `props` also erases every key added since it was captured, so
 * `editor.updateProps(id, { text })` followed by someone else's
 * `{ subtitle }` and then a local Ctrl+Z would delete their subtitle — no
 * error, no conflict, no trace. A key-scoped inverse leaves keys it never
 * touched alone.
 */
function undoPatch(inverse: InversePatch | null, id: string, store: DocumentStore, apply: typeof updateNodeProps): boolean {
  if (!inverse) return false;
  const document = store.get();
  if (!hasNode(document, id)) return false;
  store.set(apply(document, id, inverse.patch, { merge: true, unset: inverse.unset }));
  return true;
}

export class UpdatePropsCommand implements Command {
  readonly name = "updateProps";
  private inverse: InversePatch | null = null;
  private undone: EugineOperation[] = [];

  constructor(
    private readonly id: string,
    private readonly props: NodeProps,
    private readonly merge = true,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.inverse = invertPatch(getNode(document, this.id).props, this.props, this.merge);
    store.set(updateNodeProps(document, this.id, this.props, { merge: this.merge }));
  }

  undo(store: DocumentStore): void {
    this.undone =
      undoPatch(this.inverse, this.id, store, updateNodeProps) && this.inverse
        ? [{ type: "setProps", id: this.id, patch: this.inverse.patch as NodeProps, merge: true, unset: this.inverse.unset }]
        : [];
  }

  toOperation(): EugineOperation {
    return { type: "setProps", id: this.id, patch: this.props, merge: this.merge };
  }

  toUndoOperations(): EugineOperation[] {
    return this.undone;
  }
}

export class UpdateStylesCommand implements Command {
  readonly name = "updateStyles";
  private inverse: InversePatch | null = null;
  private undone: EugineOperation[] = [];

  constructor(
    private readonly id: string,
    private readonly styles: NodeStyles,
    private readonly merge = true,
  ) {}

  execute(store: DocumentStore): void {
    const document = store.get();
    this.inverse = invertPatch(getNode(document, this.id).styles, this.styles, this.merge);
    store.set(updateNodeStyles(document, this.id, this.styles, { merge: this.merge }));
  }

  undo(store: DocumentStore): void {
    this.undone =
      undoPatch(this.inverse, this.id, store, updateNodeStyles) && this.inverse
        ? [{ type: "setStyles", id: this.id, patch: this.inverse.patch as NodeStyles, merge: true, unset: this.inverse.unset }]
        : [];
  }

  toOperation(): EugineOperation {
    return { type: "setStyles", id: this.id, patch: this.styles, merge: this.merge };
  }

  toUndoOperations(): EugineOperation[] {
    return this.undone;
  }
}

/**
 * Replaces a node wholesale. Unlike the patch commands above this is
 * inherently a snapshot operation — "make the node exactly this" — so its
 * undo restores the whole previous node. Prefer updateProps/updateStyles when
 * you only mean to change some fields; in a collaborative session a replace
 * will overwrite concurrent edits to the same node by design.
 */
export class ReplaceNodeCommand implements Command {
  readonly name = "replace";
  private previous: EugineNode | null = null;
  private undone: EugineOperation[] = [];

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
    this.undone = [];
    if (!this.previous) return;
    const document = store.get();
    if (!hasNode(document, this.id)) return;
    store.set(replaceNode(document, this.id, this.previous));
    this.undone = [{ type: "replace", id: this.id, node: this.previous }];
  }

  toOperation(): EugineOperation {
    return { type: "replace", id: this.id, node: this.next };
  }

  toUndoOperations(): EugineOperation[] {
    return this.undone;
  }
}
