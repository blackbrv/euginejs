import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEditor } from "eugine";
import { toComponentDefinitions } from "../src/schema.js";
import { initHistoryPanel } from "../src/history.js";

/**
 * Guards the two bits of the History panel that can break silently: the
 * chronological ordering of undo + redo stacks, and the index math that turns
 * "click row N" into the right number of real undo()/redo() calls.
 */

function setup() {
  const editor = createEditor({ components: toComponentDefinitions() });
  const container = document.createElement("div");
  initHistoryPanel(editor, container);
  return { editor, container };
}

function rows(container: HTMLElement): { label: string; undone: boolean; current: boolean }[] {
  return [...container.querySelectorAll(".eb-history-live")].map((row) => ({
    label: row.querySelector(".eb-history-label")!.textContent!,
    undone: row.classList.contains("eb-history-undone"),
    current: row.classList.contains("eb-history-current"),
  }));
}

describe("history panel", () => {
  beforeEach(() => window.localStorage.clear());

  it("lists changes oldest-first and marks the current one", () => {
    const { editor, container } = setup();
    const root = editor.getDocument().rootId;
    editor.insert("text", root);
    editor.insert("text", root);

    expect(rows(container)).toEqual([
      { label: "Insert", undone: false, current: false },
      { label: "Insert", undone: false, current: true },
    ]);
  });

  it("keeps undone changes in place, after the current one", () => {
    const { editor, container } = setup();
    const root = editor.getDocument().rootId;
    editor.insert("text", root);
    editor.transaction(() => editor.insert("text", root), "second");
    editor.history.undo();

    expect(rows(container)).toEqual([
      { label: "Insert", undone: false, current: true },
      { label: "Second", undone: true, current: false },
    ]);
  });

  it("time-travels to the clicked row in both directions", () => {
    const { editor, container } = setup();
    const root = editor.getDocument().rootId;
    for (let i = 0; i < 3; i += 1) editor.insert("text", root);
    const nodeCount = () => Object.keys(editor.getDocument().nodes).length;
    expect(nodeCount()).toBe(4);

    // Click the first change: two undos back to a single child.
    (container.querySelectorAll(".eb-history-live")[0] as HTMLElement).click();
    expect(nodeCount()).toBe(2);
    expect(rows(container).map((r) => r.undone)).toEqual([false, true, true]);

    // Click the last: two redos forward again.
    (container.querySelectorAll(".eb-history-live")[2] as HTMLElement).click();
    expect(nodeCount()).toBe(4);
    expect(rows(container).map((r) => r.undone)).toEqual([false, false, false]);
  });

  it("details each change with what it did, old value included", () => {
    const { editor, container } = setup();
    const root = editor.getDocument().rootId;
    const id = editor.insert("heading", root);
    editor.updateProps(id, { content: "Hello" });
    editor.remove(id);

    const details = [...container.querySelectorAll(".eb-history-live")].map((row) =>
      [...row.querySelectorAll(".eb-history-details li")].map((li) => li.textContent),
    );
    expect(details).toEqual([
      ["Added heading to root"],
      ['heading · content: "A bold heading" → "Hello"'],
      ["Removed heading from root"],
    ]);
  });

  it("persists the log and replays it as inert past-session rows after a reload", async () => {
    const { editor } = setup();
    const root = editor.getDocument().rootId;
    editor.insert("text", root);
    editor.insert("text", root);
    editor.history.undo();

    // A reload = a fresh module instance reading localStorage at import time.
    vi.resetModules();
    const reloaded = await import("../src/history.js");
    const fresh = createEditor({ components: toComponentDefinitions() });
    const container = document.createElement("div");
    reloaded.renderHistory(fresh, container);

    const past = [...container.querySelectorAll(".eb-history-past")];
    expect(past).toHaveLength(2);
    expect(past[1]!.classList.contains("eb-history-undone")).toBe(true);
    // Past rows are a log, not a stack — nothing to click.
    expect(container.querySelectorAll(".eb-history-live")).toHaveLength(0);
  });
});
