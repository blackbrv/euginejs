import { EventBus } from "./events.js";
import { createEmptyDocument, validateDocument } from "./tree.js";
import { documentRevision, type EugineDocument } from "./types.js";

/**
 * Who caused a change, and whether it came from this client or another one.
 *
 * Attribution is what makes collaborative undo possible at all. Without it,
 * history is one global stack in wall-clock order, and the only Ctrl+Z it can
 * offer is "undo whatever happened last" — including a node the person next to
 * you just created.
 */
export interface ChangeOrigin {
  /** The client that authored the change, if known. */
  clientId?: string;
  /** True when the change arrived from another client rather than this one. */
  remote?: boolean;
}

export interface SetDocumentOptions {
  validate?: boolean;
  /**
   * Whether to advance `document.revision`. Defaults to true. `editor.load()`
   * passes false so a freshly loaded document keeps the revision the server
   * gave it — otherwise the client's very first save would look stale.
   */
  bumpRevision?: boolean;
  origin?: ChangeOrigin;
}

export interface DocumentStoreEvents {
  change: { document: EugineDocument; previous: EugineDocument; origin?: ChangeOrigin };
}

/**
 * Holds the current, immutable EugineDocument and notifies subscribers when
 * it is replaced. This is the only mutable cell in the engine — every tree
 * operation itself returns a brand new document.
 */
export class DocumentStore {
  private current: EugineDocument;
  private defaultOrigin: ChangeOrigin | undefined;
  readonly events = new EventBus<DocumentStoreEvents>();

  constructor(initial: EugineDocument = createEmptyDocument()) {
    validateDocument(initial);
    this.current = initial;
  }

  get(): EugineDocument {
    return this.current;
  }

  /**
   * Runs `fn` with every store write inside it attributed to `origin`.
   * Commands call `store.set()` themselves and have no idea who invoked them,
   * so the caller establishes the attribution around them instead of every
   * command having to thread it through.
   */
  withOrigin<T>(origin: ChangeOrigin | undefined, fn: () => T): T {
    const previous = this.defaultOrigin;
    this.defaultOrigin = origin;
    try {
      return fn();
    } finally {
      this.defaultOrigin = previous;
    }
  }

  /** The current document's revision — the value to send as a save's baseRevision. */
  getRevision(): number {
    return documentRevision(this.current);
  }

  /** Replaces the document wholesale (used by commands and editor.load()). */
  set(next: EugineDocument, options: SetDocumentOptions = {}): void {
    if (options.validate !== false) validateDocument(next);
    const previous = this.current;
    if (previous === next) return;

    // Only the top-level document object is rebuilt to carry the new revision;
    // every entry in `nodes` keeps its identity, so the DOM renderer's
    // reference-equality reconcile still repaints only what actually changed.
    this.current =
      options.bumpRevision === false ? next : { ...next, revision: documentRevision(previous) + 1 };

    this.events.emit("change", {
      document: this.current,
      previous,
      origin: options.origin ?? this.defaultOrigin,
    });
  }

  onChange(listener: (payload: DocumentStoreEvents["change"]) => void): () => void {
    return this.events.on("change", listener);
  }
}
