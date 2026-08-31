import { describe, expect, it } from "vitest";
import { DocumentStore } from "../src/document.js";
import { createEditor } from "../src/editor.js";
import { applyOperations } from "../src/operations.js";
import { serializeDocument } from "../src/serialization.js";
import {
  cloneSubtreeSnapshot,
  createEmptyDocument,
  createNode,
  duplicateSubtree,
  getNode,
  hasNode,
  insertNode,
  restoreSubtree,
  validateDocument,
} from "../src/tree.js";
import type { EugineDocument, EugineNode, SerializedDocument } from "../src/types.js";

describe("prototype-pollution hardening", () => {
  it("hasNode/getNode ignore inherited Object.prototype members", () => {
    const doc = createEmptyDocument();
    for (const id of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(hasNode(doc, id)).toBe(false);
      expect(() => getNode(doc, id)).toThrow();
    }
  });

  it("insertNode rejects a node id of \"__proto__\"", () => {
    const doc = createEmptyDocument();
    expect(() => insertNode(doc, createNode("text", { id: "__proto__" }), doc.rootId)).toThrow();
    // The nodes map itself must be untouched — no accidental prototype swap.
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);
  });

  it("restoreSubtree (the 'attach' remote operation) rejects a rootId of \"__proto__\", even with no matching snapshot key", () => {
    // An "attach" operation's `rootId` is a separate field from its `nodes`
    // map — a malicious client can set it without the snapshot containing a
    // matching entry at all.
    const doc = createEmptyDocument();
    expect(() => restoreSubtree(doc, {}, "__proto__", doc.rootId)).toThrow();
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);
  });

  it("restoreSubtree rejects a snapshot entry literally keyed \"__proto__\", as JSON.parse produces it over the wire", () => {
    const doc = createEmptyDocument();
    const node = createNode("text", { id: "__proto__" });
    // `{ __proto__: node }` as a JS object *literal* would set the object's
    // prototype rather than create an own property — JSON.parse, which an
    // attacker's payload actually goes through, does create a genuine own
    // enumerable property named "__proto__" instead. Reproduce that exactly.
    const malicious: Record<string, EugineNode> = JSON.parse(`{"__proto__":${JSON.stringify(node)}}`);
    expect(Object.prototype.hasOwnProperty.call(malicious, "__proto__")).toBe(true);
    expect(() => restoreSubtree(doc, malicious, "__proto__", doc.rootId)).toThrow();
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);
  });

  it("an insert/attach operation targeting \"__proto__\" throws rather than being silently applied or dropped", () => {
    // "drop" policy only covers operations whose target has vanished — it is
    // not a catch-all, so a malicious id surfaces loudly (better for a host
    // to see and disconnect the sender than to lose the attempt silently).
    const doc = createEmptyDocument();
    expect(() =>
      applyOperations(
        doc,
        [{ type: "insert", node: createNode("text", { id: "__proto__" }), parentId: doc.rootId }],
        { policy: "drop" },
      ),
    ).toThrow();
    // applyOperation(s) is documented pure — the original document is untouched.
    expect(hasNode(doc, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);
  });

  it("a setProps/move/remove operation against \"__proto__\" is dropped as not-found, never treated as existing", () => {
    const doc = createEmptyDocument();
    const result = applyOperations(
      doc,
      [{ type: "setProps", id: "__proto__", patch: { hacked: true }, merge: true }],
      { policy: "drop" },
    );
    expect(result.applied).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
    expect(Object.getPrototypeOf(result.document.nodes)).toBe(Object.prototype);
  });

  it("validateDocument rejects a whole document that already contains a node keyed \"__proto__\" (the load path, not just insertNode/restoreSubtree)", () => {
    // A document coming from loadDocument()/createEditor({ document }) is
    // never routed through insertNode/restoreSubtree at all — its `nodes`
    // map is already built. validateDocument is the only gate on that path.
    let doc = createEmptyDocument();
    const evilNode = createNode("text", { id: "__proto__" });
    const nodes = JSON.parse(`{${JSON.stringify(doc.rootId)}:${JSON.stringify(doc.nodes[doc.rootId])},"__proto__":${JSON.stringify(evilNode)}}`);
    doc = { ...doc, nodes };
    expect(Object.prototype.hasOwnProperty.call(doc.nodes, "__proto__")).toBe(true);
    expect(() => validateDocument(doc)).toThrow();
  });

  it("duplicateSubtree/cloneSubtreeSnapshot reject a host-supplied idFactory that mints \"__proto__\"", () => {
    const doc = createEmptyDocument();
    const evilFactory = () => "__proto__";
    expect(() => duplicateSubtree(doc, doc.rootId, evilFactory)).toThrow();
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);

    const snapshot = { [doc.rootId]: doc.nodes[doc.rootId]! };
    expect(() => cloneSubtreeSnapshot(snapshot, doc.rootId, evilFactory)).toThrow();
  });

  it("restoreSubtree throws instead of attaching a malformed node when rootId resolves nowhere", () => {
    // An "attach" operation whose `nodes` snapshot is empty and whose
    // `rootId` doesn't already exist anywhere used to silently spread
    // `undefined` into `{ parent: parentId }` — a node missing id/type/
    // children — and attach that into the tree.
    const doc = createEmptyDocument();
    expect(() => restoreSubtree(doc, {}, "missing-root", doc.rootId)).toThrow();
  });
});

describe("configurable maxDepth threads through the store, serialization, and editor", () => {
  function buildChain(depth: number): EugineDocument {
    let doc = createEmptyDocument();
    let parentId = doc.rootId;
    for (let i = 0; i < depth; i++) {
      const id = `n${i}`;
      doc = insertNode(doc, createNode("text", { id }), parentId);
      parentId = id;
    }
    return doc;
  }

  it("DocumentStore honors a configured maxDepth on construction and on every set()", () => {
    const deep = buildChain(50);
    expect(() => new DocumentStore(deep, { maxDepth: 10 })).toThrow();

    const store = new DocumentStore(createEmptyDocument(), { maxDepth: 10 });
    expect(() => store.set(deep)).toThrow();
    // A per-call override still wins over the store's configured default.
    expect(() => store.set(deep, { maxDepth: Infinity })).not.toThrow();
  });

  it("createEditor({ maxDepth }) lets a host with legitimately deep documents skip the default limit, without disabling validation entirely", () => {
    const deep = buildChain(2500); // beyond the library default of 2000
    const editor = createEditor({ document: deep, maxDepth: Infinity });
    expect(editor.getDocument().rootId).toBe(deep.rootId);

    // Structural validation is still active — a genuinely invalid document
    // (not just a deep one) is still rejected.
    expect(() => createEditor({ document: { ...deep, rootId: "does-not-exist" }, maxDepth: Infinity })).toThrow();

    // serialize()/save() must honor the same configured limit, not silently
    // fall back to the library default and reject a document the store
    // already accepted.
    expect(() => editor.serialize()).not.toThrow();
  });

  it("editor.load() honors a per-call maxDepth override at the store boundary, not just in loadDocument", () => {
    // Regression: load() used to forward the override to loadDocument() but
    // then re-validated the document in store.set() WITHOUT it, so a more
    // permissive per-call override let loadDocument() accept a deep document
    // that store.set() then rejected on the very next line — with a confusing
    // error and history/selection left uncleared.
    const editor = createEditor(); // default maxDepth (2000)
    const deep = buildChain(2500); // beyond the default of 2000
    const serialized: SerializedDocument = serializeDocument(deep, { maxDepth: Infinity });
    expect(() => editor.load(serialized, { maxDepth: Infinity })).not.toThrow();
    expect(editor.getDocument().rootId).toBe(deep.rootId);
  });
});

describe("validateDocument depth guard", () => {
  function buildChain(depth: number): EugineDocument {
    let doc = createEmptyDocument();
    let parentId = doc.rootId;
    for (let i = 0; i < depth; i++) {
      const id = `n${i}`;
      doc = insertNode(doc, createNode("text", { id }), parentId);
      parentId = id;
    }
    return doc;
  }

  it("accepts a document within the default depth limit", () => {
    const doc = buildChain(50);
    expect(() => validateDocument(doc)).not.toThrow();
  });

  it("rejects a document deeper than the configured maxDepth", () => {
    const doc = buildChain(50);
    expect(() => validateDocument(doc, { maxDepth: 10 })).toThrow(/nesting depth/);
  });

  it("allows an explicit maxDepth: Infinity to opt out of the check", () => {
    const doc = buildChain(50);
    expect(() => validateDocument(doc, { maxDepth: Infinity })).not.toThrow();
  });

  it("rejects a document deep enough to overflow the recursive renderers, using the default limit", () => {
    const doc = buildChain(2500);
    expect(() => validateDocument(doc)).toThrow(/nesting depth/);
  });
});
