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

    await editor.storage.save(editor.serialize(), "page-1");
    const loaded = await editor.storage.load("page-1");
    expect(loaded).toEqual(editor.serialize());
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
