import type { DocumentStore } from "../document.js";

/**
 * The unit of every document mutation. Commands are the stable foundation
 * for history, keyboard shortcuts and (later) collaboration — everything
 * that changes the document does so by executing a Command.
 */
export interface Command {
  readonly name: string;
  execute(store: DocumentStore): void;
  undo(store: DocumentStore): void;
}
