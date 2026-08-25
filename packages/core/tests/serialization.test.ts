import { describe, expect, it } from "vitest";
import { createEmptyDocument, createNode, insertNode } from "../src/tree.js";
import { MigrationRegistry, loadDocument, serializeDocument } from "../src/serialization.js";
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
