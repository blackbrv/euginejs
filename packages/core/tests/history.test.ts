import { describe, expect, it } from "vitest";
import { DocumentStore } from "../src/document.js";
import { History, type HistoryEntry } from "../src/history.js";
import { InsertNodeCommand } from "../src/commands/insert.js";
import { MoveNodeCommand } from "../src/commands/move.js";
import { createEmptyDocument, createNode, insertNode } from "../src/tree.js";

describe("History", () => {
  it("undoes and redoes a single command", () => {
    const store = new DocumentStore(createEmptyDocument());
    const history = new History(store);
    const root = store.get().rootId;

    history.execute(new InsertNodeCommand(createNode("text", { id: "t" }), root));
    expect(store.get().nodes.t).toBeDefined();

    expect(history.undo()).toBe(true);
    expect(store.get().nodes.t).toBeUndefined();

    expect(history.redo()).toBe(true);
    expect(store.get().nodes.t).toBeDefined();
  });

  it("canUndo/canRedo reflect stack state", () => {
    const store = new DocumentStore(createEmptyDocument());
    const history = new History(store);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.execute(new InsertNodeCommand(createNode("text", { id: "t" }), store.get().rootId));
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    history.undo();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it("groups a transaction of multiple commands into a single undo step", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("section", { id: "b" }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "t" }), "a");

    const store = new DocumentStore(doc);
    const history = new History(store);

    history.transaction(() => {
      history.execute(new MoveNodeCommand("t", "b"));
      // Simulate a second internal step of the same user action.
      history.execute(new MoveNodeCommand("t", "a"));
      history.execute(new MoveNodeCommand("t", "b"));
    });

    expect(store.get().nodes.b?.children).toEqual(["t"]);
    expect(history.canUndo()).toBe(true);

    history.undo();
    // One undo() call reverses ALL THREE moves inside the transaction.
    expect(store.get().nodes.a?.children).toEqual(["t"]);
    expect(store.get().nodes.b?.children).toEqual([]);
    expect(history.canUndo()).toBe(false);
  });

  it("clears the redo stack after a new command is executed", () => {
    const store = new DocumentStore(createEmptyDocument());
    const history = new History(store);
    history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));
    history.undo();
    expect(history.canRedo()).toBe(true);
    history.execute(new InsertNodeCommand(createNode("text", { id: "b" }), store.get().rootId));
    expect(history.canRedo()).toBe(false);
  });

  it("emits lifecycle events", () => {
    const store = new DocumentStore(createEmptyDocument());
    const history = new History(store);
    const events: string[] = [];
    history.events.on("beforeChange", () => events.push("beforeChange"));
    history.events.on("afterChange", () => events.push("afterChange"));
    history.events.on("change", (p) => events.push(`change:${p.kind}`));
    history.events.on("batchStart", () => events.push("batchStart"));
    history.events.on("batchEnd", () => events.push("batchEnd"));

    history.transaction(() => {
      history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));
    });

    expect(events).toEqual(["batchStart", "beforeChange", "afterChange", "change:execute", "batchEnd"]);

    history.undo();
    expect(events.at(-1)).toBe("change:undo");
  });

  it("onChange subscribes to the generic change event", () => {
    const store = new DocumentStore(createEmptyDocument());
    const history = new History(store);
    let calls = 0;
    const off = history.onChange(() => {
      calls += 1;
    });
    history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));
    off();
    history.undo();
    expect(calls).toBe(1);
  });

  describe("getUndoStack()/getRedoStack()", () => {
    it("returns plain-data entries, oldest first, with commandNames/label/timestamp/id", () => {
      const store = new DocumentStore(createEmptyDocument());
      const history = new History(store);

      history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));
      history.transaction(() => {
        history.execute(new InsertNodeCommand(createNode("text", { id: "b" }), store.get().rootId));
        history.execute(new MoveNodeCommand("b", store.get().rootId));
      }, "batch move");

      const entries = history.getUndoStack();
      expect(entries).toHaveLength(2);
      expect(entries[0]?.commandNames).toEqual(["insert"]);
      expect(entries[0]?.label).toBeUndefined();
      expect(entries[1]?.commandNames).toEqual(["insert", "move"]);
      expect(entries[1]?.label).toBe("batch move");
      for (const entry of entries) {
        expect(typeof entry.id).toBe("string");
        expect(typeof entry.timestamp).toBe("number");
      }
      // Every entry gets a distinct id.
      expect(entries[0]?.id).not.toBe(entries[1]?.id);

      expect(history.getRedoStack()).toEqual([]);
    });

    it("moves an entry from getUndoStack() to getRedoStack() on undo, preserving its id", () => {
      const store = new DocumentStore(createEmptyDocument());
      const history = new History(store);
      history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));
      const [committed] = history.getUndoStack();

      history.undo();
      expect(history.getUndoStack()).toEqual([]);
      const [undone] = history.getRedoStack();
      expect(undone?.id).toBe(committed?.id);
      expect(undone?.timestamp).toBe(committed?.timestamp);
    });

    it("clones origin rather than aliasing it: mutating an entry's origin cannot corrupt the live transaction's undo scoping", () => {
      const store = new DocumentStore(createEmptyDocument());
      const history = new History(store, { clientId: "me" });
      history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));

      const [entry] = history.getUndoStack();
      expect(entry?.origin).toEqual({ clientId: "me", remote: false });
      // A host redacting/normalizing an origin for display, in place.
      if (entry?.origin) Object.assign(entry.origin, { remote: true, clientId: "someone-else" });

      // The live transaction — and this client's ability to undo its own
      // edit — must be unaffected by that mutation.
      expect(history.getUndoStack()[0]?.isLocal).toBe(true);
      expect(history.canUndo()).toBe(true);
      expect(history.undo()).toBe(true);
      expect(store.get().nodes.a).toBeUndefined();
    });

    it("returns a snapshot: mutating the returned array does not affect later calls", () => {
      const store = new DocumentStore(createEmptyDocument());
      const history = new History(store);
      history.execute(new InsertNodeCommand(createNode("text", { id: "a" }), store.get().rootId));

      const entries = history.getUndoStack() as HistoryEntry[];
      entries.pop();
      expect(entries).toHaveLength(0);
      expect(history.getUndoStack()).toHaveLength(1);
    });

    it("marks isLocal per-entry so a host can distinguish remote transactions in a shared timeline", () => {
      const store = new DocumentStore(createEmptyDocument());
      const history = new History(store, { clientId: "me" });

      history.execute(new InsertNodeCommand(createNode("text", { id: "mine" }), store.get().rootId));
      history.execute(new InsertNodeCommand(createNode("text", { id: "theirs" }), store.get().rootId));
      // Simulate a transaction explicitly authored elsewhere landing on the
      // same stack — matches how collaboration-gaps.test.ts's G3 does it,
      // since applyRemote() normally bypasses history entirely.
      const stack = history as unknown as { undoStack: { origin?: { clientId?: string; remote?: boolean } }[] };
      stack.undoStack[stack.undoStack.length - 1]!.origin = { clientId: "them", remote: true };

      const entries = history.getUndoStack();
      expect(entries.map((e) => e.isLocal)).toEqual([true, false]);
      // Undo only ever reaches the local one, even though it isn't last.
      expect(history.canUndo()).toBe(true);
      history.undo();
      expect(store.get().nodes.mine).toBeUndefined();
      expect(store.get().nodes.theirs).toBeDefined();
    });
  });
});
