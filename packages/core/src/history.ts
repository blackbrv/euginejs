import type { DocumentStore } from "./document.js";
import { EventBus } from "./events.js";
import type { Command } from "./commands/types.js";

export interface Transaction {
  commands: Command[];
  label?: string;
}

export interface HistoryEvents {
  beforeChange: { command: Command };
  change: { transaction: Transaction; kind: "execute" | "undo" | "redo" | "clear" };
  afterChange: { transaction: Transaction };
  undo: { transaction: Transaction };
  redo: { transaction: Transaction };
  batchStart: { label?: string };
  batchEnd: { transaction: Transaction };
}

/**
 * Command-oriented, transaction-aware undo/redo stack. A `transaction()`
 * groups any number of commands (e.g. the four internal steps of a drag
 * operation) into a single undo step, matching the PRD's requirement that
 * a drag produces exactly one undo, not four.
 */
export class History {
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  private activeTransaction: Transaction | null = null;
  readonly events = new EventBus<HistoryEvents>();

  constructor(private readonly store: DocumentStore) {}

  /** Executes a single command as its own transaction (unless called inside transaction()). */
  execute(command: Command): void {
    this.events.emit("beforeChange", { command });
    command.execute(this.store);

    if (this.activeTransaction) {
      this.activeTransaction.commands.push(command);
      return;
    }
    this.commit({ commands: [command] }, "execute");
  }

  /** Groups every command executed inside `fn` into a single undo/redo step. */
  transaction<T>(fn: () => T, label?: string): T {
    if (this.activeTransaction) {
      // Nested transactions flatten into the outer, already-open one.
      return fn();
    }
    this.activeTransaction = { commands: [], label };
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
    this.undoStack.push(transaction);
    this.redoStack = [];
    this.events.emit("afterChange", { transaction });
    this.events.emit("change", { transaction, kind });
  }

  undo(): boolean {
    const transaction = this.undoStack.pop();
    if (!transaction) return false;
    for (const command of transaction.commands.slice().reverse()) {
      command.undo(this.store);
    }
    this.redoStack.push(transaction);
    this.events.emit("undo", { transaction });
    this.events.emit("change", { transaction, kind: "undo" });
    return true;
  }

  redo(): boolean {
    const transaction = this.redoStack.pop();
    if (!transaction) return false;
    for (const command of transaction.commands) {
      command.execute(this.store);
    }
    this.undoStack.push(transaction);
    this.events.emit("redo", { transaction });
    this.events.emit("change", { transaction, kind: "redo" });
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  onChange(listener: (payload: HistoryEvents["change"]) => void): () => void {
    return this.events.on("change", listener);
  }
}
