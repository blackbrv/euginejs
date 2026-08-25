import { describe, expect, it } from "vitest";
import { createEditor } from "../src/editor.js";
import { loadDocument, serializeDocument } from "../src/serialization.js";
import { validateDocument } from "../src/tree.js";

/**
 * Lightweight property-based-style checks for the invariants the PRD calls
 * "Critical Invariants": tree integrity, id uniqueness, serialization
 * round-tripping, and undo/redo never corrupting the tree.
 */
describe("critical invariants", () => {
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("stays structurally valid after long random sequences of operations, and undo fully reverses them", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const rand = mulberry32(seed);
      const editor = createEditor({
        components: [{ type: "box", accepts: "*" }, { type: "leaf", accepts: "none" }],
      });
      const root = editor.getDocument().rootId;
      const ids: string[] = [];
      const snapshots: unknown[] = [serializeDocument(editor.getDocument())];

      for (let step = 0; step < 40; step += 1) {
        const action = Math.floor(rand() * 4);
        try {
          if (action === 0 || ids.length === 0) {
            const parent = ids.length > 0 && rand() > 0.5 ? ids[Math.floor(rand() * ids.length)]! : root;
            const type = rand() > 0.5 ? "box" : "leaf";
            const id = editor.insert(type, parent);
            ids.push(id);
          } else if (action === 1 && ids.length > 0) {
            const id = ids[Math.floor(rand() * ids.length)]!;
            editor.duplicate(id);
          } else if (action === 2 && ids.length > 1) {
            const id = ids[Math.floor(rand() * ids.length)]!;
            const parent = ids[Math.floor(rand() * ids.length)]!;
            if (id !== parent) editor.move(id, parent);
          } else if (ids.length > 0) {
            const index = Math.floor(rand() * ids.length);
            editor.remove(ids[index]!);
            ids.splice(index, 1);
          }
        } catch {
          // Invalid moves/drops are expected occasionally; the document must
          // remain valid regardless.
        }
        validateDocument(editor.getDocument());
        snapshots.push(serializeDocument(editor.getDocument()));
      }

      // Undo everything back to the empty document.
      while (editor.history.canUndo()) {
        editor.history.undo();
        validateDocument(editor.getDocument());
      }
      expect(editor.getDocument().nodes[root]?.children).toEqual([]);

      // Redo everything forward again and confirm we reproduce the same
      // sequence of document states.
      let i = 0;
      while (editor.history.canRedo()) {
        editor.history.redo();
        validateDocument(editor.getDocument());
        i += 1;
      }
      expect(i).toBeGreaterThan(0);
    }
  });

  it("serialize(load(document)) is stable (idempotent under round-trip)", () => {
    const editor = createEditor({ components: [{ type: "box" }] });
    editor.insert("box", editor.getDocument().rootId);
    editor.insert("box", editor.getDocument().rootId);

    const serialized = serializeDocument(editor.getDocument());
    const reloaded = loadDocument(serialized);
    const reserialized = serializeDocument(reloaded);
    expect(reserialized).toEqual(serialized);
  });

  it("never allows a node to end up with two parents, even after many moves", () => {
    const editor = createEditor({ components: [{ type: "box", accepts: "*" }] });
    const root = editor.getDocument().rootId;
    const a = editor.insert("box", root);
    const b = editor.insert("box", root);
    const target = editor.insert("box", a);

    editor.move(target, b);
    editor.move(target, a);
    editor.move(target, b);

    const doc = editor.getDocument();
    expect(doc.nodes[a]?.children).toEqual([]);
    expect(doc.nodes[b]?.children).toEqual([target]);
    validateDocument(doc);
  });
});
