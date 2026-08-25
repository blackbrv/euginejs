import { EventBus } from "./events.js";
import { createEmptyDocument, validateDocument } from "./tree.js";
import type { EugineDocument } from "./types.js";

export interface DocumentStoreEvents {
  change: { document: EugineDocument; previous: EugineDocument };
}

/**
 * Holds the current, immutable EugineDocument and notifies subscribers when
 * it is replaced. This is the only mutable cell in the engine — every tree
 * operation itself returns a brand new document.
 */
export class DocumentStore {
  private current: EugineDocument;
  readonly events = new EventBus<DocumentStoreEvents>();

  constructor(initial: EugineDocument = createEmptyDocument()) {
    validateDocument(initial);
    this.current = initial;
  }

  get(): EugineDocument {
    return this.current;
  }

  /** Replaces the document wholesale (used by commands and editor.load()). */
  set(next: EugineDocument, options: { validate?: boolean } = {}): void {
    if (options.validate !== false) validateDocument(next);
    const previous = this.current;
    if (previous === next) return;
    this.current = next;
    this.events.emit("change", { document: next, previous });
  }

  onChange(listener: (payload: DocumentStoreEvents["change"]) => void): () => void {
    return this.events.on("change", listener);
  }
}
