import type { DocumentStore } from "../document.js";
import type { EugineOperation } from "../operations.js";

/**
 * The unit of every document mutation. Commands are the stable foundation
 * for history, keyboard shortcuts and collaboration — everything that changes
 * the document does so by executing a Command.
 *
 * Two rules keep commands safe in a session with more than one author:
 *
 * 1. `undo()` must compute its inverse against the document *as it is now*,
 *    not restore a snapshot of how it looked at execute time. A snapshot also
 *    reverts everything that happened after it was taken, which in a shared
 *    document means silently deleting someone else's work.
 * 2. `undo()` must tolerate its target being gone. Another client may have
 *    removed the node in the meantime; that is a no-op, not an error.
 */
export interface Command {
  readonly name: string;
  execute(store: DocumentStore): void;
  undo(store: DocumentStore): void;
  /**
   * This command's effect as serializable data, for sending to other clients.
   * Only meaningful after `execute()` has run — commands that generate ids
   * (insert, duplicate, wrap) must report the ids they actually created, so
   * every client agrees on node identity.
   *
   * Returns null when the command has not executed yet. Optional so a host's
   * own custom commands still satisfy the interface; a transaction containing
   * one that cannot serialize simply is not transmittable (see
   * `transactionToOperations`).
   */
  toOperation?(): EugineOperation | null;
}
