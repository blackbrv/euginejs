import { describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  createNode,
  duplicateSubtree,
  insertNode,
  moveNode,
  removeNode,
  reorderChildren,
  unwrapNode,
  validateDocument,
  wrapNode,
} from "../src/tree.js";
import { EugineError } from "../src/errors.js";

describe("tree operations", () => {
  it("creates an empty document with a valid root", () => {
    const doc = createEmptyDocument();
    expect(doc.nodes[doc.rootId]).toBeDefined();
    expect(() => validateDocument(doc)).not.toThrow();
  });

  it("inserts a node under a parent", () => {
    const doc = createEmptyDocument();
    const hero = createNode("section", { id: "hero" });
    const next = insertNode(doc, hero, doc.rootId);
    expect(next.nodes.hero?.parent).toBe(doc.rootId);
    expect(next.nodes[doc.rootId]?.children).toEqual(["hero"]);
    validateDocument(next);
  });

  it("does not mutate the original document (immutability)", () => {
    const doc = createEmptyDocument();
    const hero = createNode("section", { id: "hero" });
    insertNode(doc, hero, doc.rootId);
    expect(doc.nodes.hero).toBeUndefined();
    expect(doc.nodes[doc.rootId]?.children).toEqual([]);
  });

  it("rejects inserting a duplicate id", () => {
    const doc = createEmptyDocument();
    let next = insertNode(doc, createNode("section", { id: "hero" }), doc.rootId);
    expect(() => insertNode(next, createNode("section", { id: "hero" }), doc.rootId)).toThrow(EugineError);
  });

  it("inserts at a specific index", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("a", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("b", { id: "b" }), doc.rootId);
    doc = insertNode(doc, createNode("c", { id: "c" }), doc.rootId, 1);
    expect(doc.nodes[doc.rootId]?.children).toEqual(["a", "c", "b"]);
  });

  it("removes a node and its whole subtree", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "hero" }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "heading" }), "hero");
    doc = removeNode(doc, "hero");
    expect(doc.nodes.hero).toBeUndefined();
    expect(doc.nodes.heading).toBeUndefined();
    expect(doc.nodes[doc.rootId]?.children).toEqual([]);
  });

  it("refuses to remove the root", () => {
    const doc = createEmptyDocument();
    expect(() => removeNode(doc, doc.rootId)).toThrow(EugineError);
  });

  it("moves a node to a new parent", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("section", { id: "b" }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "t" }), "a");
    doc = moveNode(doc, "t", "b");
    expect(doc.nodes.a?.children).toEqual([]);
    expect(doc.nodes.b?.children).toEqual(["t"]);
    expect(doc.nodes.t?.parent).toBe("b");
  });

  it("refuses to move a node into its own subtree", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("section", { id: "b" }), "a");
    expect(() => moveNode(doc, "a", "b")).toThrow(EugineError);
  });

  it("reorders children", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("x", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("x", { id: "b" }), doc.rootId);
    doc = insertNode(doc, createNode("x", { id: "c" }), doc.rootId);
    doc = reorderChildren(doc, doc.rootId, ["c", "a", "b"]);
    expect(doc.nodes[doc.rootId]?.children).toEqual(["c", "a", "b"]);
  });

  it("duplicates a subtree with fresh ids", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "hero" }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "heading" }), "hero");
    const { document: next, newId } = duplicateSubtree(doc, "hero");
    expect(newId).not.toBe("hero");
    expect(next.nodes[newId]?.children).toHaveLength(1);
    const clonedChildId = next.nodes[newId]!.children[0]!;
    expect(clonedChildId).not.toBe("heading");
    expect(next.nodes[clonedChildId]?.type).toBe("text");
    // original subtree untouched
    expect(next.nodes.hero?.children).toEqual(["heading"]);
  });

  it("wraps and unwraps a node, preserving position", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "t" }), doc.rootId);
    const { document: wrapped, wrapperId } = wrapNode(doc, "t", "container", { id: "wrapper" });
    expect(wrapped.nodes[doc.rootId]?.children).toEqual([wrapperId]);
    expect(wrapped.nodes[wrapperId]?.children).toEqual(["t"]);

    const unwrapped = unwrapNode(wrapped, wrapperId);
    expect(unwrapped.nodes[doc.rootId]?.children).toEqual(["t"]);
    expect(unwrapped.nodes[wrapperId]).toBeUndefined();
  });

  it("validateDocument rejects a node referenced by two parents", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("a", { id: "a" }), doc.rootId);
    doc = insertNode(doc, createNode("b", { id: "b" }), doc.rootId);
    // Manually corrupt the document: reference "child" from both a and b.
    const corrupted = {
      ...doc,
      nodes: {
        ...doc.nodes,
        child: createNode("x", { id: "child" }),
        a: { ...doc.nodes.a!, children: ["child"] },
        b: { ...doc.nodes.b!, children: ["child"] },
      },
    };
    corrupted.nodes.child = { ...corrupted.nodes.child!, parent: "a" };
    expect(() => validateDocument(corrupted)).toThrow(EugineError);
  });
});
