import { describe, expect, it } from "vitest";
import { createEmptyDocument, createNode, insertNode } from "../src/tree.js";
import { MigrationRegistry, isSerializedDocument, loadDocument, serializeDocument } from "../src/serialization.js";
import { EugineError } from "../src/errors.js";

describe("serialization", () => {
  it("round-trips a document through serialize/load", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "hero", props: { title: "Hi" } }), doc.rootId);

    const serialized = serializeDocument(doc);
    expect(serialized.engine).toBe("eugine");
    expect(serialized.schemaVersion).toBe(1);

    const loaded = loadDocument(serialized);
    expect(loaded).toEqual(doc);
  });

  it("rejects an unrecognized engine field", () => {
    const doc = createEmptyDocument();
    const serialized = { ...serializeDocument(doc), engine: "other-engine" as "eugine" };
    expect(() => loadDocument(serialized)).toThrow(EugineError);
  });

  it("throws EUGINE_MIGRATION_FAILED for an old schema version without migrations", () => {
    const doc = createEmptyDocument();
    const serialized = serializeDocument({ ...doc, schemaVersion: 0 });
    expect(() => loadDocument(serialized)).toThrow(EugineError);
    try {
      loadDocument(serialized);
    } catch (error) {
      expect((error as EugineError).code).toBe("EUGINE_MIGRATION_FAILED");
    }
  });

  it("runs a registered migration to reach the current schema version", () => {
    const doc = createEmptyDocument();
    const legacy = { ...doc, schemaVersion: 0 };
    const serialized = serializeDocument(legacy);

    const migrations = new MigrationRegistry();
    migrations.register({
      from: 0,
      to: 1,
      migrate: (d) => ({ ...d, nodes: { ...d.nodes, [d.rootId]: { ...d.nodes[d.rootId]!, metadata: { migrated: true } } } }),
    });

    const loaded = loadDocument(serialized, { migrations });
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.nodes[loaded.rootId]?.metadata).toEqual({ migrated: true });
  });

  it("fails structural validation on a corrupted document", () => {
    const doc = createEmptyDocument();
    const serialized = serializeDocument(doc);
    serialized.document = { ...serialized.document, rootId: "does-not-exist" };
    expect(() => loadDocument(serialized)).toThrow(EugineError);
  });
});

describe("isSerializedDocument", () => {
  it("accepts a real serialized document", () => {
    const serialized: unknown = serializeDocument(createEmptyDocument());
    expect(isSerializedDocument(serialized)).toBe(true);
    // Narrowed: this compiles only because isSerializedDocument is a type guard.
    if (isSerializedDocument(serialized)) {
      expect(serialized.document.rootId).toBe("root");
    }
  });

  it("rejects values parsed from arbitrary/untrusted JSON", () => {
    const notEvenClose: unknown = JSON.parse('{"hello":"world"}');
    expect(isSerializedDocument(notEvenClose)).toBe(false);

    const wrongEngine: unknown = JSON.parse(JSON.stringify({ ...serializeDocument(createEmptyDocument()), engine: "other" }));
    expect(isSerializedDocument(wrongEngine)).toBe(false);
  });

  it("rejects primitives, null, and arrays", () => {
    expect(isSerializedDocument(null)).toBe(false);
    expect(isSerializedDocument(undefined)).toBe(false);
    expect(isSerializedDocument("a string")).toBe(false);
    expect(isSerializedDocument(42)).toBe(false);
    expect(isSerializedDocument([])).toBe(false);
  });

  it("rejects an envelope whose inner document is malformed", () => {
    const serialized = serializeDocument(createEmptyDocument());
    const missingRootId: unknown = { ...serialized, document: { ...serialized.document, rootId: undefined } };
    expect(isSerializedDocument(missingRootId)).toBe(false);

    const nodesNotAnObject: unknown = { ...serialized, document: { ...serialized.document, nodes: "not-an-object" } };
    expect(isSerializedDocument(nodesNotAnObject)).toBe(false);
  });
});
