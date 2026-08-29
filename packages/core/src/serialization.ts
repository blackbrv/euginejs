import { EugineError } from "./errors.js";
import { validateDocument } from "./tree.js";
import { CURRENT_SCHEMA_VERSION, type EugineDocument, type SerializedDocument } from "./types.js";

const ENGINE_VERSION = "0.1.0";

/** Wraps a document in the canonical, versioned envelope used for persistence. */
export function serializeDocument(document: EugineDocument): SerializedDocument {
  validateDocument(document);
  return {
    schemaVersion: document.schemaVersion,
    engine: "eugine",
    engineVersion: ENGINE_VERSION,
    document,
  };
}

export interface Migration {
  from: number;
  to: number;
  migrate(document: EugineDocument): EugineDocument;
}

/** Deterministic, testable schema migrations between document schema versions. */
export class MigrationRegistry {
  private migrations = new Map<number, Migration>();

  register(migration: Migration): void {
    this.migrations.set(migration.from, migration);
  }

  migrate(document: EugineDocument, targetVersion: number = CURRENT_SCHEMA_VERSION): EugineDocument {
    let current = document;
    let guard = 0;
    while (current.schemaVersion < targetVersion) {
      const migration = this.migrations.get(current.schemaVersion);
      if (!migration) {
        throw new EugineError(
          "EUGINE_MIGRATION_FAILED",
          `No migration registered from schema version ${current.schemaVersion} towards ${targetVersion}.`,
          { context: { from: current.schemaVersion, to: targetVersion } },
        );
      }
      current = { ...migration.migrate(current), schemaVersion: migration.to };
      guard += 1;
      if (guard > 1000) {
        throw new EugineError("EUGINE_MIGRATION_FAILED", "Migration chain exceeded 1000 steps; likely a registration cycle.");
      }
    }
    return current;
  }
}

/**
 * A runtime type guard for the untrusted-JSON boundary — `localStorage`,
 * `JSON.parse`, `fetch(...).json()`, an HTTP request body, and similar APIs
 * are all typed `any` by TypeScript's own standard library, so a plain
 * `as SerializedDocument` there is an unchecked leap of faith, not a real
 * guarantee. This actually verifies the shape before narrowing, so hosts
 * never have to blind-cast data coming off the wire:
 *
 *   const parsed: unknown = JSON.parse(raw);
 *   if (!isSerializedDocument(parsed)) throw new Error("not a eugine document");
 *   editor.load(parsed); // `parsed` is now genuinely known to be SerializedDocument
 *
 * Deeper structural validation of the document itself (tree integrity, id
 * uniqueness, ...) still happens in loadDocument()/validateDocument() — this
 * only rules out payloads that couldn't possibly be a SerializedDocument.
 */
export function isSerializedDocument(value: unknown): value is SerializedDocument {
  if (typeof value !== "object" || value === null) return false;
  const envelope = value as Record<string, unknown>;

  if (typeof envelope.schemaVersion !== "number") return false;
  if (envelope.engine !== "eugine") return false;
  if (typeof envelope.engineVersion !== "string") return false;

  const document = envelope.document;
  if (typeof document !== "object" || document === null) return false;
  const doc = document as Record<string, unknown>;

  return typeof doc.schemaVersion === "number" && typeof doc.rootId === "string" && typeof doc.nodes === "object" && doc.nodes !== null;
}

export interface LoadDocumentOptions {
  migrations?: MigrationRegistry;
}

/** Parses + validates a SerializedDocument, running migrations if the schema version is behind. */
export function loadDocument(serialized: SerializedDocument, options: LoadDocumentOptions = {}): EugineDocument {
  if (serialized.engine !== "eugine") {
    throw new EugineError(
      "EUGINE_SERIALIZATION_FAILED",
      `Unrecognized "engine" field "${String(serialized.engine)}"; expected "eugine".`,
    );
  }

  let document = serialized.document;
  if (document.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    if (!options.migrations) {
      throw new EugineError(
        "EUGINE_MIGRATION_FAILED",
        `Document schema version ${document.schemaVersion} does not match the supported version ${CURRENT_SCHEMA_VERSION}, and no MigrationRegistry was provided to load().`,
        { context: { documentVersion: document.schemaVersion, supportedVersion: CURRENT_SCHEMA_VERSION } },
      );
    }
    document = options.migrations.migrate(document, CURRENT_SCHEMA_VERSION);
  }

  try {
    validateDocument(document);
  } catch (error) {
    throw new EugineError("EUGINE_SERIALIZATION_FAILED", "The document failed structural validation after loading.", {
      cause: error,
    });
  }

  return document;
}
