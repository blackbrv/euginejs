import type { ChangeOrigin, DocumentStore } from "./document.js";
import { EugineError } from "./errors.js";
import { EventBus } from "./events.js";
import type { EugineOperation } from "./operations.js";
import type { Command } from "./commands/types.js";

export interface Transaction {
  commands: Command[];
  label?: string;
  /**
   * Who authored this transaction. Undo only ever reaches back for a
   * transaction this client authored — see History's `clientId` option.
   */
  origin?: ChangeOrigin;
  /**
   * Assigned once, the first time this transaction is committed (see
   * History.getUndoStack()/getRedoStack()) — stable across every later
   * undo/redo move, since it's the same object the whole time. Absent on a
   * transaction that hasn't been committed yet (e.g. mid-`transaction()`).
   */
  id?: string;
  /** Commit time (`Date.now()`), assigned alongside `id`. */
  timestamp?: number;
}

/**
 * A read-only, serializable view of one transaction on the undo/redo stack —
 * enough to build a history timeline/browser UI without exposing the
 * `Command` instances themselves (which have private fields and closures,
 * and which a UI could otherwise call `execute()`/`undo()` on directly,
 * bypassing History's stack bookkeeping and the atomic-replay guarantee).
 */
export interface HistoryEntry {
  readonly id: string;
  readonly label: string | undefined;
  /** Command names, in execution order — e.g. `["insert", "move"]` for a two-step transaction. */
  readonly commandNames: readonly string[];
  readonly timestamp: number;
  readonly origin: ChangeOrigin | undefined;
  /** Whether this client's undo()/redo() can reach this entry — see HistoryOptions.clientId. */
  readonly isLocal: boolean;
}

export interface HistoryEvents {
  beforeChange: { command: Command };
  change: { transaction: Transaction; kind: "execute" | "undo" | "redo" | "clear" };
  afterChange: { transaction: Transaction };
  undo: { transaction: Transaction };
  redo: { transaction: Transaction };
  batchStart: { label?: string };
  batchEnd: { transaction: Transaction };
  /** A committed transaction, ready to be serialized and sent to other clients. */
  commit: { transaction: Transaction; operations: EugineOperation[] | null };
}

export interface HistoryOptions {
  /**
   * Identifies this client. When set, `undo()`/`redo()` skip transactions
   * authored elsewhere, so pressing Ctrl+Z never reverts the edit a colleague
   * just made.
   *
   * This is per-client scoping, not full operational transformation: an undo
   * that reaches past a later remote edit replays each command's inverse
   * against the *current* document, which is safe (it will not clobber or
   * throw) but does not attempt to transform intent the way a full OT or CRDT
   * layer would.
   */
  clientId?: string;
}

/** Every operation in a transaction, or null if any command cannot serialize. */
export function transactionToOperations(transaction: Transaction): EugineOperation[] | null {
  const operations: EugineOperation[] = [];
  for (const command of transaction.commands) {
    const operation = command.toOperation?.();
    if (!operation) return null;
    operations.push(operation);
  }
  return operations;
}

/**
 * Command-oriented, transaction-aware undo/redo stack. A `transaction()`
 * groups any number of commands (e.g. the four internal steps of a drag
 * operation) into a single undo step, matching the PRD's requirement that
 * a drag produces exactly one undo, not four.
 *
 * Replaying a transaction is atomic: if any command throws part-way, the
 * document is restored to how it looked before the replay started and both
 * stacks are left untouched. Without that, a single throwing `undo()` leaves
 * the document half-reverted *and* drops the transaction from both stacks,
 * putting the user's edit permanently out of reach of undo and redo alike.
 */
export class History {
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  private activeTransaction: Transaction | null = null;
  private readonly clientId: string | undefined;
  private transactionSeq = 0;
  readonly events = new EventBus<HistoryEvents>();

  constructor(
    private readonly store: DocumentStore,
    options: HistoryOptions = {},
  ) {
    this.clientId = options.clientId;
  }

  private localOrigin(): ChangeOrigin | undefined {
    return this.clientId === undefined ? undefined : { clientId: this.clientId, remote: false };
  }

  /** True if this client may undo the given transaction. */
  private isLocal(transaction: Transaction): boolean {
    if (transaction.origin?.remote) return false;
    if (this.clientId === undefined) return true;
    const author = transaction.origin?.clientId;
    return author === undefined || author === this.clientId;
  }

  /** Executes a single command as its own transaction (unless called inside transaction()). */
  execute(command: Command): void {
    this.events.emit("beforeChange", { command });
    this.store.withOrigin(this.localOrigin(), () => command.execute(this.store));

    if (this.activeTransaction) {
      this.activeTransaction.commands.push(command);
      return;
    }
    this.commit({ commands: [command], origin: this.localOrigin() }, "execute");
  }

  /** Groups every command executed inside `fn` into a single undo/redo step. */
  transaction<T>(fn: () => T, label?: string): T {
    if (this.activeTransaction) {
      // Nested transactions flatten into the outer, already-open one.
      return fn();
    }
    this.activeTransaction = { commands: [], label, origin: this.localOrigin() };
    this.events.emit("batchStart", { label });
    try {
      const result = fn();
      const tx = this.activeTransaction;
      this.activeTransaction = null;
      if (tx.commands.length > 0) this.commit(tx, "execute");
      this.events.emit("batchEnd", { transaction: tx });
      return result;
    } catch (error) {
      this.activeTransaction = null;
      throw error;
    }
  }

  private commit(transaction: Transaction, kind: "execute" | "undo" | "redo"): void {
    // Assigned once, here, the moment a transaction first enters a stack —
    // undo()/redo() only ever move this same object between stacks
    // afterwards, so the id/timestamp stay stable for its whole lifetime.
    transaction.id ??= `tx_${++this.transactionSeq}`;
    transaction.timestamp ??= Date.now();
    this.undoStack.push(transaction);
    this.redoStack = [];
    this.events.emit("afterChange", { transaction });
    this.events.emit("change", { transaction, kind });
    this.events.emit("commit", { transaction, operations: transactionToOperations(transaction) });
  }

  /**
   * Replays a transaction atomically. On failure the document is rolled back
   * to exactly where it started and the error is rethrown, so the caller can
   * leave both stacks untouched.
   */
  private replay(transaction: Transaction, direction: "undo" | "redo"): void {
    const before = this.store.get();
    const commands = direction === "undo" ? [...transaction.commands].reverse() : transaction.commands;

    try {
      this.store.withOrigin(transaction.origin ?? this.localOrigin(), () => {
        for (const command of commands) {
          if (direction === "undo") command.undo(this.store);
          else command.execute(this.store);
        }
      });
    } catch (error) {
      this.store.set(before, { validate: false });
      throw new EugineError("EUGINE_HISTORY_ERROR", `Failed to ${direction} transaction; the document was rolled back.`, {
        cause: error,
        context: { direction, label: transaction.label },
      });
    }
  }

  /** The index of the newest transaction this client is allowed to undo. */
  private findLocal(stack: Transaction[]): number {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const transaction = stack[i];
      if (transaction && this.isLocal(transaction)) return i;
    }
    return -1;
  }

  undo(): boolean {
    const index = this.findLocal(this.undoStack);
    const transaction = this.undoStack[index];
    if (!transaction) return false;

    // Replay first, mutate the stacks only once it has actually succeeded.
    this.replay(transaction, "undo");

    this.undoStack.splice(index, 1);
    this.redoStack.push(transaction);
    this.events.emit("undo", { transaction });
    this.events.emit("change", { transaction, kind: "undo" });
    return true;
  }

  redo(): boolean {
    const index = this.findLocal(this.redoStack);
    const transaction = this.redoStack[index];
    if (!transaction) return false;

    this.replay(transaction, "redo");

    this.redoStack.splice(index, 1);
    this.undoStack.push(transaction);
    this.events.emit("redo", { transaction });
    this.events.emit("change", { transaction, kind: "redo" });
    return true;
  }

  canUndo(): boolean {
    return this.findLocal(this.undoStack) !== -1;
  }

  canRedo(): boolean {
    return this.findLocal(this.redoStack) !== -1;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private toEntry(transaction: Transaction): HistoryEntry {
    return {
      // Only ever undefined for a transaction that has never been through
      // commit() — every transaction reachable from undoStack/redoStack has.
      id: transaction.id!,
      label: transaction.label,
      commandNames: transaction.commands.map((command) => command.name),
      timestamp: transaction.timestamp!,
      // Cloned, not aliased: `HistoryEntry.origin` is only readonly at the
      // type level — a host mutating this object in place (e.g. redacting a
      // clientId for display) would otherwise reach through to the live
      // Transaction.origin that isLocal()/replay() consult, corrupting the
      // per-client undo-scoping guarantee for a transaction still on a stack.
      origin: transaction.origin ? { ...transaction.origin } : undefined,
      isLocal: this.isLocal(transaction),
    };
  }

  /**
   * A read-only snapshot of the transactions this client can currently
   * undo, oldest first — for building a history timeline, browser, or
   * custom undo/redo UI. Plain data, not the live stack: mutating the
   * returned array has no effect, and there is no way to reach the
   * underlying `Command` instances (call `undo()`/`redo()` to actually act
   * on one). Includes transactions from every client, not just this one —
   * check `isLocal` to tell which entries this client's own `undo()` can
   * reach; `canUndo()` is `entries.some(e => e.isLocal)` restricted to the
   * one nearest the end, which is exactly what `undo()` acts on next.
   */
  getUndoStack(): readonly HistoryEntry[] {
    return this.undoStack.map((transaction) => this.toEntry(transaction));
  }

  /** Same as getUndoStack(), for the transactions this client can currently redo. */
  getRedoStack(): readonly HistoryEntry[] {
    return this.redoStack.map((transaction) => this.toEntry(transaction));
  }

  onChange(listener: (payload: HistoryEvents["change"]) => void): () => void {
    return this.events.on("change", listener);
  }

  /** Fires for every committed transaction, with its serializable operations. */
  onCommit(listener: (payload: HistoryEvents["commit"]) => void): () => void {
    return this.events.on("commit", listener);
  }
}
