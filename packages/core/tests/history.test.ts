import { describe, expect, it } from "vitest";
import { DocumentStore } from "../src/document.js";
import { History } from "../src/history.js";
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
});
