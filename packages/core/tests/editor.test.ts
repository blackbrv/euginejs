import { describe, expect, it, vi } from "vitest";
import { createEditor } from "../src/editor.js";
import { EugineError } from "../src/errors.js";
import { MemoryStorageAdapter, createAutosave } from "../src/storage.js";

function buildBasicEditor() {
  const editor = createEditor({
    components: [
      { type: "section", accepts: "*" },
      { type: "text", accepts: "none", defaults: { props: { content: "Hello" } } },
      { type: "grid", accepts: ["card"], maxChildren: 2 },
      { type: "card" },
    ],
  });
  return editor;
}

describe("createEditor", () => {
  it("starts with an empty document and no selection", () => {
    const editor = buildBasicEditor();
    expect(editor.getDocument().nodes[editor.getDocument().rootId]).toBeDefined();
    expect(editor.selection.get()).toEqual([]);
  });

  it("inserts a node with defaults merged from the registered component", () => {
    const editor = buildBasicEditor();
    const id = editor.insert("text", editor.getDocument().rootId);
    expect(editor.getNode(id).props.content).toBe("Hello");
  });

  it("throws when inserting an unregistered component type", () => {
    const editor = buildBasicEditor();
    expect(() => editor.insert("unknown", editor.getDocument().rootId)).toThrow(EugineError);
  });

  it("enforces drop rules on insert", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const textId = editor.insert("text", root);
    expect(() => editor.insert("text", textId)).toThrow(EugineError);
  });

  it("enforces maxChildren on insert", () => {
    const editor = buildBasicEditor();
    const gridId = editor.insert("grid", editor.getDocument().rootId);
    editor.insert("card", gridId);
    editor.insert("card", gridId);
    expect(() => editor.insert("card", gridId)).toThrow(EugineError);
  });

  it("removes, moves and duplicates nodes with full undo/redo support", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const sectionId = editor.insert("section", root);
    const textId = editor.insert("text", sectionId);

    const duplicatedId = editor.duplicate(textId);
    expect(editor.getNode(sectionId).children).toHaveLength(2);

    editor.remove(duplicatedId);
    expect(editor.getNode(sectionId).children).toEqual([textId]);

    expect(editor.history.canUndo()).toBe(true);
    editor.history.undo();
    expect(editor.getNode(sectionId).children).toHaveLength(2);
  });

  it("copies a subtree and pastes a fresh-id clone into a different parent", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const sourceSection = editor.insert("section", root);
    const textId = editor.insert("text", sourceSection, { props: { content: "Copy me" } });

    const snapshot = editor.copySubtree(textId);
    const targetSection = editor.insert("section", root);
    const pastedId = editor.pasteSubtree(snapshot, targetSection);

    expect(pastedId).not.toBe(textId);
    expect(editor.getNode(targetSection).children).toEqual([pastedId]);
    expect(editor.getNode(pastedId).props.content).toBe("Copy me");
    // The original is untouched — copy is non-destructive.
    expect(editor.getNode(sourceSection).children).toEqual([textId]);
  });

  it("pastes the same snapshot multiple times without id collisions", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const section = editor.insert("section", root);
    const textId = editor.insert("text", section);
    const snapshot = editor.copySubtree(textId);

    const first = editor.pasteSubtree(snapshot, section);
    const second = editor.pasteSubtree(snapshot, section);

    expect(new Set([textId, first, second]).size).toBe(3);
    expect(editor.getNode(section).children).toEqual([textId, first, second]);
  });

  it("pastes a subtree (with descendants) as one undo step", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const section = editor.insert("section", root);
    editor.insert("text", section);
    const snapshot = editor.copySubtree(section); // section + its text child

    const pastedId = editor.pasteSubtree(snapshot, root);
    expect(editor.getNode(pastedId).children).toHaveLength(1);

    editor.history.undo();
    expect(editor.getDocument().nodes[pastedId]).toBeUndefined();
    // Undoing the paste must not touch the original subtree it was copied from.
    expect(editor.getNode(section).children).toHaveLength(1);
  });

  it("emits structured lifecycle + document events", () => {
    const editor = buildBasicEditor();
    const events: string[] = [];
    editor.events.on("node.create", () => events.push("node.create"));
    editor.events.on("node.delete", () => events.push("node.delete"));
    editor.events.on("document.change", () => events.push("document.change"));

    const id = editor.insert("text", editor.getDocument().rootId);
    editor.remove(id);

    // The document store emits "change" synchronously from inside
    // history.execute(), before the higher-level editor event fires.
    expect(events).toEqual(["document.change", "node.create", "document.change", "node.delete"]);
  });

  it("clears selection when the selected node is removed", () => {
    const editor = buildBasicEditor();
    const id = editor.insert("text", editor.getDocument().rootId);
    editor.selection.select(id);
    editor.remove(id);
    expect(editor.selection.get()).toEqual([]);
  });

  it("clears selection of a descendant when an ancestor is removed", () => {
    const editor = buildBasicEditor();
    const sectionId = editor.insert("section", editor.getDocument().rootId);
    const textId = editor.insert("text", sectionId);
    editor.selection.select(textId);

    editor.remove(sectionId);

    expect(editor.selection.get()).toEqual([]);
  });

  it("keeps selection state consistent with the document for any document.change listener, even one firing synchronously during remove()", () => {
    const editor = buildBasicEditor();
    const sectionId = editor.insert("section", editor.getDocument().rootId);
    const textId = editor.insert("text", sectionId);
    editor.selection.select(textId);

    // A host app commonly re-renders a property panel off document.change by
    // looking up the current selection — this must never throw, even though
    // the listener runs synchronously inside the remove() call that just
    // deleted the selected node's ancestor.
    let observedDuringChange: unknown;
    editor.events.on("document.change", () => {
      const selectedId = editor.selection.get()[0];
      observedDuringChange = selectedId ? editor.getNode(selectedId) : undefined;
    });

    expect(() => editor.remove(sectionId)).not.toThrow();
    expect(observedDuringChange).toBeUndefined();
  });

  it("serializes and reloads a document", () => {
    const editor = buildBasicEditor();
    editor.insert("text", editor.getDocument().rootId);
    const serialized = editor.serialize();

    const fresh = buildBasicEditor();
    fresh.load(serialized);
    expect(fresh.serialize()).toEqual(serialized);
    expect(fresh.history.canUndo()).toBe(false);
  });

  it("runs the plugin lifecycle: install, initialize, ready, destroy", () => {
    const calls: string[] = [];
    const editor = createEditor({
      plugins: [
        {
          name: "logger",
          install: () => calls.push("install"),
          initialize: () => calls.push("initialize"),
          ready: () => calls.push("ready"),
          destroy: () => calls.push("destroy"),
        },
      ],
    });
    expect(calls).toEqual(["install", "initialize", "ready"]);
    editor.destroy();
    expect(calls).toEqual(["install", "initialize", "ready", "destroy"]);
  });

  it("saves and loads documents through a storage adapter", async () => {
    const editor = buildBasicEditor();
    editor.insert("text", editor.getDocument().rootId);
    editor.storage.use(new MemoryStorageAdapter());

    const result = await editor.storage.save(editor.serialize(), { id: "page-1" });
    expect(result.ok).toBe(true);

    const loaded = await editor.storage.load("page-1");
    expect(loaded).toEqual(editor.serialize());
  });

  it("rejects a save based on a revision the adapter has moved past", async () => {
    const editor = buildBasicEditor();
    editor.storage.use(new MemoryStorageAdapter());
    editor.insert("text", editor.getDocument().rootId);

    // A first client saves, establishing a revision on the server.
    expect((await editor.save()).ok).toBe(true);
    const staleRevision = editor.store.getRevision();

    // A second client saves work of their own on top of it.
    const other = buildBasicEditor();
    other.storage.use(editor.storage);
    other.load((await other.storage.load())!);
    other.insert("text", other.getDocument().rootId);
    other.insert("text", other.getDocument().rootId);
    expect((await other.save()).ok).toBe(true);

    // The first client, still holding the old revision, must not silently win.
    const conflicted = await editor.storage.save(editor.serialize(), { baseRevision: staleRevision });
    expect(conflicted.ok).toBe(false);
    if (!conflicted.ok) {
      expect(conflicted.reason).toBe("conflict");
      expect(conflicted.current).toBeDefined();
    }
  });

  it("rejects a stale save even when the stale client made more edits", async () => {
    const adapter = new MemoryStorageAdapter();
    const a = buildBasicEditor();
    const b = buildBasicEditor();
    a.storage.use(adapter);
    b.storage.use(adapter);

    a.insert("text", a.getDocument().rootId);
    expect((await a.save()).ok).toBe(true);

    // B started from the same empty document and never saw A's save; its
    // local edit counter (2) is ahead of the stored revision (1).
    b.insert("text", b.getDocument().rootId);
    b.insert("text", b.getDocument().rootId);
    expect((await b.save()).ok).toBe(false);

    // A keeps saving on top of its own write.
    a.insert("text", a.getDocument().rootId);
    expect((await a.save()).ok).toBe(true);
    expect(a.getBaseRevision()).toBe(a.store.getRevision());
  });

  it("throws a clear error when no storage adapter is configured", async () => {
    const editor = buildBasicEditor();
    await expect(editor.storage.save(editor.serialize())).rejects.toThrow(EugineError);
  });

  it("debounces autosave on document changes", async () => {
    vi.useFakeTimers();
    const editor = buildBasicEditor();
    const save = vi.fn();
    const stop = createAutosave(editor.store, save, { debounceMs: 500 });

    editor.insert("text", editor.getDocument().rootId);
    editor.insert("section", editor.getDocument().rootId);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);

    stop();
    vi.useRealTimers();
  });
});

describe("every mutating editor method validates against the registry", () => {
  it("duplicate respects maxChildren", () => {
    const editor = buildBasicEditor();
    const grid = editor.insert("grid", editor.getDocument().rootId);
    const card = editor.insert("card", grid);
    editor.insert("card", grid);
    expect(() => editor.duplicate(card)).toThrow(expect.objectContaining({ code: "EUGINE_INVALID_DROP" }));
  });

  it("pasteSubtree respects accepts and rejects unregistered types inside the snapshot", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const text = editor.insert("text", root);
    const section = editor.insert("section", root);
    expect(() => editor.pasteSubtree(editor.copySubtree(section), text)).toThrow(
      expect.objectContaining({ code: "EUGINE_INVALID_DROP" }),
    );

    const snapshot = editor.copySubtree(section);
    const foreign = { ...snapshot, nodes: { ...snapshot.nodes, [section]: { ...snapshot.nodes[section]!, type: "alien" } } };
    expect(() => editor.pasteSubtree(foreign, root)).toThrow(
      expect.objectContaining({ code: "EUGINE_COMPONENT_NOT_REGISTERED" }),
    );
  });

  it("wrap rejects an unregistered wrapper and a wrapper that won't accept the node", () => {
    const editor = buildBasicEditor();
    const text = editor.insert("text", editor.getDocument().rootId);
    expect(() => editor.wrap(text, "alien")).toThrow(expect.objectContaining({ code: "EUGINE_COMPONENT_NOT_REGISTERED" }));
    expect(() => editor.wrap(text, "grid")).toThrow(expect.objectContaining({ code: "EUGINE_INVALID_DROP" }));
  });

  it("unwrap rejects children the parent won't accept, and locked wrappers", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;

    // grid only accepts cards: unwrapping a card that holds text would put text in it.
    const grid = editor.insert("grid", root);
    const card = editor.insert("card", grid);
    editor.insert("text", card);
    expect(() => editor.unwrap(card)).toThrow(expect.objectContaining({ code: "EUGINE_INVALID_DROP" }));

    const text = editor.insert("text", root);
    const locked = editor.wrap(text, "section", { locked: true });
    expect(() => editor.unwrap(locked)).toThrow(expect.objectContaining({ code: "EUGINE_INVALID_DROP" }));
  });

  it("replace cannot change children, or the type of a locked node", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const section = editor.insert("section", root, { locked: true });
    editor.insert("text", section);
    const node = editor.getNode(section);
    expect(() => editor.replace(section, { ...node, children: [] })).toThrow(
      expect.objectContaining({ code: "EUGINE_DOCUMENT_INVALID" }),
    );
    expect(() => editor.replace(section, { ...node, type: "card" })).toThrow(
      expect.objectContaining({ code: "EUGINE_INVALID_DROP" }),
    );
    // Toggling a flag on a locked node is still allowed.
    editor.replace(section, { ...node, locked: false });
    expect(editor.getNode(section).locked).toBe(false);
  });

  it("refuses to remove an ancestor of a locked node", () => {
    const editor = buildBasicEditor();
    const section = editor.insert("section", editor.getDocument().rootId);
    editor.insert("text", section, { locked: true });
    expect(() => editor.remove(section)).toThrow(expect.objectContaining({ code: "EUGINE_INVALID_DROP" }));
    expect(editor.getNode(section)).toBeDefined();
  });

  it("restores locked/hidden/editable when an unwrap is undone", () => {
    const editor = buildBasicEditor();
    const text = editor.insert("text", editor.getDocument().rootId);
    const wrapper = editor.wrap(text, "section", { hidden: true, editable: false });
    editor.unwrap(wrapper);
    editor.history.undo();
    expect(editor.getNode(wrapper)).toMatchObject({ hidden: true, editable: false });
  });

  it("reorder rejects a repeated child id", () => {
    const editor = buildBasicEditor();
    const root = editor.getDocument().rootId;
    const a = editor.insert("text", root);
    const b = editor.insert("text", root);
    expect(() => editor.reorder(root, [a, a, b])).toThrow(expect.objectContaining({ code: "EUGINE_DOCUMENT_INVALID" }));
  });
});
