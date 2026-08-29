/**
 * Regression tests for the concurrency audit (G1–G7).
 *
 * Each block previously documented a way a second concurrent editor destroyed
 * a user's work. They now assert the fixed behaviour, so a regression on any
 * of them fails the suite rather than quietly returning the old bug.
 */
import { describe, expect, it, vi } from "vitest";
import { createEditor } from "../src/editor.js";
import { DocumentStore } from "../src/document.js";
import { EventBus } from "../src/events.js";
import { EugineError } from "../src/errors.js";
import { InsertNodeCommand } from "../src/commands/insert.js";
import { createAutosave } from "../src/storage.js";
import { applyOperations, type EugineOperation } from "../src/operations.js";
import {
  createNode,
  hasNode,
  insertNode,
  invertPatch,
  reconcileOrder,
  updateNodeProps,
  validateDocument,
} from "../src/tree.js";

function makeEditor(clientId?: string) {
  const editor = createEditor(clientId === undefined ? {} : { clientId });
  editor.registerComponent({ type: "box", accepts: "*" });
  editor.registerComponent({ type: "heading", accepts: "none" });
  return editor;
}

describe("G1 — undo is key-scoped, not a snapshot restore", () => {
  it("keeps props another user wrote after the local command ran", () => {
    const editor = makeEditor();
    const h = editor.insert("heading", "root", { props: { text: "Original" } });

    // User A edits the text.
    editor.updateProps(h, { text: "A's text" });

    // User B's edit arrives from the server and is applied to A's store.
    editor.applyRemote([{ type: "setProps", id: h, patch: { subtitle: "B's subtitle" }, merge: true }]);
    expect(editor.getNode(h).props).toEqual({ text: "A's text", subtitle: "B's subtitle" });

    // A undoes their own text edit. It reverts `text` and nothing else.
    editor.history.undo();

    expect(editor.getNode(h).props).toEqual({ text: "Original", subtitle: "B's subtitle" });
  });

  it("unsets only the keys the undone command introduced", () => {
    const editor = makeEditor();
    const h = editor.insert("heading", "root", { props: { text: "Original" } });

    editor.updateProps(h, { color: "red" }); // a key that did not exist before
    editor.applyRemote([{ type: "setProps", id: h, patch: { weight: "bold" }, merge: true }]);

    editor.history.undo();

    expect(editor.getNode(h).props).toEqual({ text: "Original", weight: "bold" });
  });

  it("does not clobber a concurrent style edit to a different property", () => {
    const editor = makeEditor();
    const h = editor.insert("heading", "root", { styles: { color: "black" } });

    editor.updateStyles(h, { color: "blue" });
    editor.applyRemote([{ type: "setStyles", id: h, patch: { fontSize: "32px" }, merge: true }]);

    editor.history.undo();

    expect(editor.getNode(h).styles).toEqual({ color: "black", fontSize: "32px" });
  });

  it("restores a removed subtree without overwriting nodes that came back", () => {
    const editor = makeEditor();
    const container = editor.insert("box", "root");
    const child = editor.insert("heading", container, { props: { text: "original" } });

    editor.remove(container);
    editor.history.undo();

    expect(hasNode(editor.getDocument(), child)).toBe(true);
    expect(editor.getNode(child).props.text).toBe("original");
    validateDocument(editor.getDocument());
  });
});

describe("G2 — a failing replay rolls back instead of stranding the document", () => {
  it("leaves the document and both stacks intact when undo cannot complete", () => {
    const editor = makeEditor();
    const a = editor.insert("box", "root");
    const b = editor.insert("box", "root");
    const h = editor.insert("heading", a, { props: { text: "before" } });

    editor.transaction(() => {
      editor.reorder("root", [b, a]);
      editor.updateProps(h, { text: "after" });
    }, "user action");

    // A remote user adds a sibling under root before A undoes.
    editor.applyRemote([{ type: "insert", node: createNode("box", { id: "remote" }), parentId: "root" }]);

    // The reorder no longer matches the live child set — which used to throw
    // mid-replay. It now reconciles instead, so the undo simply succeeds.
    expect(editor.history.undo()).toBe(true);

    expect(editor.getNode(h).props.text).toBe("before");
    expect(editor.getNode("root").children).toEqual([a, b, "remote"]);
    expect(editor.history.canRedo()).toBe(true);
    validateDocument(editor.getDocument());
  });

  it("rolls the document back and keeps the transaction undoable if a command still throws", () => {
    const editor = makeEditor();
    const target = editor.insert("box", "root");
    const h = editor.insert("heading", "root", { props: { text: "before" } });

    const exploding = {
      name: "exploding",
      execute: () => {},
      undo: () => {
        throw new Error("cannot undo this");
      },
    };

    // Ordered so that undo (which replays in reverse) reverts the props edit
    // first and only then hits the command that throws — the case where a
    // partial revert is already sitting in the document when it fails.
    editor.transaction(() => {
      editor.runCommand(exploding);
      editor.updateProps(h, { text: "after" });
    });

    const undoStackDepth = (editor.history as unknown as { undoStack: unknown[] }).undoStack.length;
    expect(() => editor.history.undo()).toThrow(EugineError);

    // The half-done revert was rolled back: the props edit is still applied.
    expect(editor.getNode(h).props.text).toBe("after");
    expect(hasNode(editor.getDocument(), target)).toBe(true);
    // The transaction is still on the stack, not stranded between the two.
    expect(editor.history.canUndo()).toBe(true);
    expect(editor.history.canRedo()).toBe(false);
    expect((editor.history as unknown as { undoStack: unknown[] }).undoStack.length).toBe(undoStackDepth);
    validateDocument(editor.getDocument());
  });

  it("reports a rollback as EUGINE_HISTORY_ERROR with the original cause", () => {
    const editor = makeEditor();
    editor.runCommand({
      name: "exploding",
      execute: () => {},
      undo: () => {
        throw new Error("underlying reason");
      },
    });

    try {
      editor.history.undo();
      expect.unreachable("undo should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EugineError);
      expect((error as EugineError).code).toBe("EUGINE_HISTORY_ERROR");
      expect((error as { cause?: Error }).cause?.message).toBe("underlying reason");
    }
  });
});

describe("G3 — undo is scoped to the client that authored the edit", () => {
  it("does not let A's Ctrl+Z revert a node B created", () => {
    const editor = makeEditor("client-a");
    const before = editor.getNode("root").children.length;

    // B's insert, applied the way a sync layer should apply it.
    editor.applyRemote([{ type: "insert", node: createNode("box", { id: "b-node" }), parentId: "root" }], {
      clientId: "client-b",
    });
    expect(hasNode(editor.getDocument(), "b-node")).toBe(true);

    // A has authored nothing, so there is nothing for them to undo.
    expect(editor.history.canUndo()).toBe(false);
    expect(editor.history.undo()).toBe(false);
    expect(hasNode(editor.getDocument(), "b-node")).toBe(true);
    expect(editor.getNode("root").children.length).toBe(before + 1);
  });

  it("skips a remote transaction on the shared stack and undoes the local one", () => {
    const editor = makeEditor("client-a");
    const mine = editor.insert("box", "root");

    // A transaction explicitly authored elsewhere, pushed onto the same stack.
    editor.history.execute(new InsertNodeCommand(createNode("box", { id: "b-node" }), "root"));
    const stack = editor.history as unknown as { undoStack: { origin?: { remote?: boolean } }[] };
    stack.undoStack[stack.undoStack.length - 1]!.origin = { clientId: "client-b", remote: true };

    expect(editor.history.undo()).toBe(true);

    // A's own node went away; B's did not.
    expect(hasNode(editor.getDocument(), mine)).toBe(false);
    expect(hasNode(editor.getDocument(), "b-node")).toBe(true);
  });

  it("applyRemote never touches the local undo stack", () => {
    const editor = makeEditor("client-a");
    editor.applyRemote([{ type: "insert", node: createNode("box", { id: "b-node" }), parentId: "root" }]);
    expect(editor.history.canUndo()).toBe(false);
  });
});

describe("G4 — a remote op against a vanished node is dropped, not fatal", () => {
  it("skips the op and keeps applying the rest of the batch", () => {
    const editor = makeEditor();
    const container = editor.insert("box", "root");
    editor.remove(container);

    const ops: EugineOperation[] = [
      { type: "insert", node: createNode("box", { id: "orphan" }), parentId: container },
      { type: "insert", node: createNode("box", { id: "survivor" }), parentId: "root" },
    ];

    const result = editor.applyRemote(ops);

    expect(result.dropped).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect(hasNode(editor.getDocument(), "orphan")).toBe(false);
    expect(hasNode(editor.getDocument(), "survivor")).toBe(true);
  });

  it("still throws under the explicit \"throw\" policy", () => {
    const editor = makeEditor();
    const container = editor.insert("box", "root");
    editor.remove(container);

    expect(() =>
      editor.applyRemote([{ type: "insert", node: createNode("box"), parentId: container }], { policy: "throw" }),
    ).toThrow(/was not found in the document/);
  });

  it("is idempotent when a transport redelivers the same operation", () => {
    const editor = makeEditor();
    const op: EugineOperation = { type: "insert", node: createNode("box", { id: "once" }), parentId: "root" };

    editor.applyRemote([op]);
    const second = editor.applyRemote([op]);

    expect(second.applied).toHaveLength(0);
    expect(second.dropped).toHaveLength(1);
    expect(editor.getNode("root").children.filter((id) => id === "once")).toHaveLength(1);
    validateDocument(editor.getDocument());
  });
});

describe("G5 — autosave flushes pending work and saves are versioned", () => {
  it("writes the last change when the editor is destroyed inside the debounce window", async () => {
    vi.useFakeTimers();
    try {
      const store = new DocumentStore();
      const saved: number[] = [];
      const autosave = createAutosave(store, (d) => void saved.push(Object.keys(d.nodes).length), {
        debounceMs: 1000,
      });

      store.set(insertNode(store.get(), createNode("box", { id: "unsaved" }), "root"));
      await vi.advanceTimersByTimeAsync(500); // user closes the tab

      expect(autosave.isPending()).toBe(true);
      await autosave.stop();

      expect(saved).toEqual([2]); // the edit was persisted, not discarded
      expect(autosave.isPending()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still allows discarding explicitly", async () => {
    vi.useFakeTimers();
    try {
      const store = new DocumentStore();
      const saved: number[] = [];
      const autosave = createAutosave(store, (d) => void saved.push(Object.keys(d.nodes).length), {
        debounceMs: 1000,
        flushOnStop: false,
      });

      store.set(insertNode(store.get(), createNode("box"), "root"));
      await vi.advanceTimersByTimeAsync(500);
      await autosave.stop();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(saved).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances the document revision on every write", () => {
    const editor = makeEditor();
    const start = editor.store.getRevision();
    editor.insert("box", "root");
    expect(editor.store.getRevision()).toBeGreaterThan(start);
  });
});

describe("G6 — operations serialize, and node.select fires", () => {
  it("turns a committed transaction into operations another client can apply", () => {
    const source = makeEditor("client-a");
    const captured: EugineOperation[] = [];
    source.history.onCommit(({ operations }) => {
      expect(operations).not.toBeNull();
      if (operations) captured.push(...operations);
    });

    const box = source.insert("box", "root");
    source.insert("heading", box, { props: { text: "Hello" } });
    source.updateStyles(box, { padding: "16px" });

    // The operations survive a round trip through JSON — the point of the
    // whole format is that it can cross a network.
    const wire: unknown = JSON.parse(JSON.stringify(captured));
    const replica = makeEditor("client-b");
    const result = applyOperations(replica.getDocument(), wire as EugineOperation[], { policy: "throw" });

    expect(result.dropped).toHaveLength(0);
    validateDocument(result.document);
    expect(result.document.nodes).toEqual(source.getDocument().nodes);
  });

  it("serializes duplicate and wrap with the ids they actually created", () => {
    const editor = makeEditor();
    const box = editor.insert("box", "root");
    editor.insert("heading", box, { props: { text: "x" } });

    const operations: EugineOperation[] = [];
    editor.history.onCommit(({ operations: ops }) => void (ops && operations.push(...ops)));

    const copyId = editor.duplicate(box);
    const wrapperId = editor.wrap(box, "box");

    const attach = operations.find((op) => op.type === "attach");
    const wrap = operations.find((op) => op.type === "wrap");
    expect(attach?.type === "attach" && attach.rootId).toBe(copyId);
    expect(wrap?.type === "wrap" && wrap.wrapperId).toBe(wrapperId);
  });

  it("emits node.select when the selection changes", () => {
    const editor = makeEditor();
    const id = editor.insert("box", "root");

    const events: { ids: string[]; previous: string[] }[] = [];
    editor.events.on("node.select", (payload) => void events.push(payload));

    editor.selection.select(id);

    expect(events).toEqual([{ ids: [id], previous: [] }]);
  });
});

describe("G7 — a throwing listener does not starve the ones behind it", () => {
  it("keeps delivering the event to every remaining listener", () => {
    const errors: unknown[] = [];
    const bus = new EventBus<{ change: { n: number } }>({
      onListenerError: (error) => void errors.push(error),
    });
    const seen: string[] = [];

    bus.on("change", () => {
      throw new Error("a collaboration listener blew up");
    });
    bus.on("change", () => void seen.push("renderer"));

    expect(() => bus.emit("change", { n: 1 })).not.toThrow();
    expect(seen).toEqual(["renderer"]);
    expect(errors).toHaveLength(1);
  });
});

describe("redo determinism", () => {
  it("reuses the ids a duplicate created instead of minting new ones", () => {
    const editor = makeEditor();
    const box = editor.insert("box", "root");
    editor.insert("heading", box, { props: { text: "x" } });

    const copyId = editor.duplicate(box);
    editor.history.undo();
    editor.history.redo();

    expect(hasNode(editor.getDocument(), copyId)).toBe(true);
  });

  it("reuses the id a wrap created", () => {
    const editor = makeEditor();
    const box = editor.insert("box", "root");
    const wrapperId = editor.wrap(box, "box");

    editor.history.undo();
    editor.history.redo();

    expect(hasNode(editor.getDocument(), wrapperId)).toBe(true);
  });
});

describe("client-scoped ids", () => {
  it("uses the configured idFactory for every node the editor creates", () => {
    let n = 0;
    const editor = createEditor({ clientId: "c7", idFactory: () => `c7_${(n += 1)}` });
    editor.registerComponent({ type: "box", accepts: "*" });

    const box = editor.insert("box", "root");
    editor.insert("box", box);
    const copy = editor.duplicate(box);
    const wrapper = editor.wrap(box, "box");

    for (const id of [box, copy, wrapper]) expect(id.startsWith("c7_")).toBe(true);
    for (const id of Object.keys(editor.getDocument().nodes)) {
      expect(id === "root" || id.startsWith("c7_")).toBe(true);
    }
  });
});

describe("two clients editing the same document", () => {
  it("converges without either losing work", () => {
    const a = makeEditor("a");
    const b = makeEditor("b");

    const aOps: EugineOperation[] = [];
    const bOps: EugineOperation[] = [];
    a.history.onCommit(({ operations }) => void (operations && aOps.push(...operations)));
    b.history.onCommit(({ operations }) => void (operations && bOps.push(...operations)));

    // Both start from the same document.
    const heading = createNode("heading", { id: "shared-heading", props: { text: "Title" } });
    const seed: EugineOperation[] = [{ type: "insert", node: heading, parentId: "root" }];
    a.applyRemote(seed);
    b.applyRemote(seed);

    // The PRD's canonical example: A edits the text, B edits the style.
    a.updateProps("shared-heading", { text: "A's title" });
    b.updateStyles("shared-heading", { color: "red" });

    // Each ships its own operations to the other.
    a.applyRemote(bOps, { clientId: "b" });
    b.applyRemote(aOps, { clientId: "a" });

    for (const editor of [a, b]) {
      expect(editor.getNode("shared-heading").props.text).toBe("A's title");
      expect(editor.getNode("shared-heading").styles).toEqual({ color: "red" });
      validateDocument(editor.getDocument());
    }
    expect(a.getDocument().nodes).toEqual(b.getDocument().nodes);
  });

  it("keeps a remote edit when the local user undoes their own overlapping one", () => {
    const editor = makeEditor("a");
    const h = editor.insert("heading", "root", { props: { text: "Title" } });

    editor.updateProps(h, { text: "A's edit" });
    editor.applyRemote([{ type: "setStyles", id: h, patch: { color: "red" }, merge: true }], { clientId: "b" });

    editor.history.undo();

    expect(editor.getNode(h).props.text).toBe("Title");
    expect(editor.getNode(h).styles).toEqual({ color: "red" });
  });
});

describe("document.change carries origin", () => {
  it("marks remote changes as remote and local ones as local", () => {
    const editor = makeEditor("client-a");
    const origins: (string | undefined)[] = [];
    editor.events.on("document.change", ({ origin }) => {
      origins.push(origin?.remote ? "remote" : origin?.clientId);
    });

    editor.insert("box", "root");
    editor.applyRemote([{ type: "insert", node: createNode("box", { id: "r" }), parentId: "root" }], {
      clientId: "client-b",
    });

    expect(origins).toEqual(["client-a", "remote"]);
  });
});

describe("tree helpers used by the fixes", () => {
  it("reconcileOrder drops ids that are gone and appends ones that appeared", () => {
    expect(reconcileOrder(["b", "a", "new"], ["c", "b", "a"])).toEqual(["b", "a", "new"]);
    expect(reconcileOrder(["a", "b"], ["b", "a"])).toEqual(["b", "a"]);
    expect(reconcileOrder([], ["a"])).toEqual([]);
  });

  it("invertPatch restores touched keys and unsets introduced ones", () => {
    expect(invertPatch({ a: 1 }, { a: 2, b: 3 }, true)).toEqual({ patch: { a: 1 }, unset: ["b"] });
    // A non-merging write also touches the keys it dropped.
    expect(invertPatch({ a: 1, c: 9 }, { b: 3 }, false)).toEqual({ patch: { a: 1, c: 9 }, unset: ["b"] });
  });

  it("updateNodeProps unsets the keys it is told to", () => {
    const editor = makeEditor();
    const h = editor.insert("heading", "root", { props: { keep: 1, drop: 2 } });
    const next = updateNodeProps(editor.getDocument(), h, {}, { merge: true, unset: ["drop"] });
    expect(next.nodes[h]?.props).toEqual({ keep: 1 });
  });
});
