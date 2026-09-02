import type { SerializedDocument } from "@euginejs/core";

/**
 * A durable, permanent snapshot of a document — distinct from an in-session
 * undo/redo `Transaction` (`@euginejs/core`'s `History`), which is ephemeral
 * and cleared on `editor.load()`. `document` is the full serialized envelope
 * (schemaVersion included), so restoring an old version runs through the
 * exact same `editor.load()` migration path as any other document.
 */
export interface DocumentVersion {
  /** Stable id for this version, independent of `number` (see IdFactory in VersioningOptions). */
  readonly id: string;
  /** 1, 2, 3, ... — monotonically increasing per document, assigned by the adapter's save(), never reused. */
  readonly number: number;
  readonly document: SerializedDocument;
  /** Commit time (`Date.now()`), assigned by Versioning.createVersion(). */
  readonly createdAt: number;
  /** Who created this version, if known — defaults to the editor's `clientId`. */
  readonly author?: string;
  /** A human-facing name, e.g. "Draft", "Published", "Before redesign". */
  readonly label?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Where version history is stored. Deliberately separate from
 * `@euginejs/core`'s `StorageAdapter`: that interface holds exactly one
 * current document per id and is free to overwrite it on every save, which
 * is the opposite of what version history needs — an adapter here must
 * never overwrite or delete an existing version.
 */
export interface VersionAdapter {
  /**
   * Appends a new version and returns it with its final, assigned `number`.
   * Assigning the number is the adapter's job, not `Versioning`'s: only the
   * adapter can make "the next number" atomic for its own backend — a
   * database auto-increment column, a transactional read-modify-write, a
   * unique constraint — which a generic "list everything, then compute
   * max + 1" in `Versioning` cannot be for every possible backend. Must
   * never overwrite or delete an existing version.
   */
  save(documentId: string, version: Omit<DocumentVersion, "number">): Promise<DocumentVersion> | DocumentVersion;
  /** Every version stored for `documentId`. Order does not matter — Versioning sorts by `number` itself. */
  list(documentId: string): Promise<DocumentVersion[]> | DocumentVersion[];
  get(documentId: string, versionId: string): Promise<DocumentVersion | undefined> | DocumentVersion | undefined;
}

/**
 * Deep-clones a DocumentVersion. `document` is a JSON-serializable
 * SerializedDocument and `metadata` is declared `Record<string, unknown>`, so
 * a JSON round-trip is a safe deep clone — deliberately used instead of
 * `structuredClone`, whose type is declared only in the DOM lib / @types/node
 * and isn't part of this package's `lib: ["ES2022"]` (no DOM) type surface,
 * so it would break `tsc --noEmit` for a consumer building this package
 * standalone without those ambient types.
 */
function cloneVersion(version: DocumentVersion): DocumentVersion {
  return JSON.parse(JSON.stringify(version)) as DocumentVersion;
}

/**
 * Non-persistent adapter, useful for tests and quick prototyping — mirrors
 * `@euginejs/core`'s `MemoryStorageAdapter` in spirit. Keeps every version
 * ever saved, per document id, for the life of the process.
 *
 * `save()` is synchronous and numbers versions from the last entry in its
 * own array (`+1`), with no `await` between reading and appending — so two
 * concurrent `save()` calls (e.g. `Promise.all([...])`) can never observe
 * the same "next number" and race, unlike computing it externally from a
 * separate `list()` round-trip would. Every version handed to or returned
 * from this adapter is deep-cloned, so mutating a version object obtained
 * from `list()`/`get()` — or a version object you're about to pass to
 * `save()` — can never reach through to what's actually stored.
 */
export class MemoryVersionAdapter implements VersionAdapter {
  private versions = new Map<string, DocumentVersion[]>();

  save(documentId: string, version: Omit<DocumentVersion, "number">): DocumentVersion {
    const list = this.versions.get(documentId);
    const number = (list && list.length > 0 ? list[list.length - 1]!.number : 0) + 1;
    const withNumber = { ...version, number };

    // Two independent clones, not one clone of another: the stored copy must
    // be safe from the caller mutating `version` after this call returns,
    // and the returned copy must be safe from the caller mutating *that*
    // without corrupting what's stored — one clone can only ever guarantee
    // one of those two directions.
    const stored = cloneVersion(withNumber);
    if (list) list.push(stored);
    else this.versions.set(documentId, [stored]);

    return cloneVersion(withNumber);
  }

  list(documentId: string): DocumentVersion[] {
    return (this.versions.get(documentId) ?? []).map(cloneVersion);
  }

  get(documentId: string, versionId: string): DocumentVersion | undefined {
    const version = this.versions.get(documentId)?.find((v) => v.id === versionId);
    return version ? cloneVersion(version) : undefined;
  }
}
