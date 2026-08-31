import { createId, EventBus, type Editor, type EuginePlugin, type IdFactory } from "@eugine/core";
import type { DocumentVersion, VersionAdapter } from "./adapter.js";
import { VersioningError } from "./errors.js";

export interface VersioningOptions {
  adapter: VersionAdapter;
  /**
   * Which document this instance manages versions for — mirrors
   * `StorageAdapter`'s `SaveOptions.id`, so a host already keying saves by
   * document id can reuse the same value here. Defaults to `"default"`.
   */
  documentId?: string;
  /** Mints version ids. Defaults to `createId("version")`. */
  idFactory?: IdFactory;
}

export interface CreateVersionOptions {
  label?: string;
  /** Defaults to the editor's configured `clientId`. */
  author?: string;
  metadata?: Record<string, unknown>;
}

export interface RestoreVersionOptions {
  /**
   * Whether restoring also appends a brand-new version recording the
   * restored content, so the version list only ever grows and nothing
   * already saved is ever truncated, overwritten, or renumbered — a
   * rollback, not a history rewrite. Defaults to true.
   */
  recordRestore?: boolean;
  /** Label for the auto-recorded restore version. Defaults to `Restored from version ${number}`. Ignored when `recordRestore` is false. */
  label?: string;
}

/** What actually happened, returned by restoreVersion() and mirrored on the "version.restore" event. */
export interface RestoreResult {
  /** The version that was loaded into the live editor. */
  restoredFrom: DocumentVersion;
  /**
   * The new version recording the restore — present unless
   * `RestoreVersionOptions.recordRestore` was `false`, in which case the
   * live document still changed but nothing new was saved.
   */
  recordedVersion: DocumentVersion | undefined;
}

export interface VersioningEvents {
  "version.create": { version: DocumentVersion };
  /** Fires whenever restoreVersion() changes the live document — even when called with `{ recordRestore: false }` and nothing new is saved. */
  "version.restore": RestoreResult;
}

/**
 * Persistent, durable document versions — "Draft v12" / "Published v10"
 * (PRD §75) — kept deliberately separate from `@eugine/core`'s `History`
 * (in-session undo/redo, cleared on `editor.load()`, gone on page refresh).
 * A version is a checkpoint a host creates explicitly (on publish, on a
 * timer, on a "save version" button) via `createVersion()`, not something
 * recorded on every keystroke.
 *
 * Installs as a plugin (`editor.use(new Versioning(...))`) rather than
 * living in `@eugine/core` itself — see PRD §75: "Version management itself
 * should remain outside the core unless a dedicated plugin provides it."
 *
 * Every error this class throws is a `VersioningError` — including one
 * wrapping whatever your `VersionAdapter` or `editor.load()` itself threw,
 * so `error instanceof VersioningError` reliably tells you the failure came
 * from a versioning operation, and `error.cause` still gets you to the
 * original.
 */
export class Versioning implements EuginePlugin<Editor> {
  readonly name = "eugine-versioning";
  readonly events = new EventBus<VersioningEvents>();

  private readonly adapter: VersionAdapter;
  private readonly documentId: string;
  private readonly idFactory: IdFactory;
  private editor: Editor | undefined;

  constructor(options: VersioningOptions) {
    this.adapter = options.adapter;
    this.documentId = options.documentId ?? "default";
    this.idFactory = options.idFactory ?? (() => createId("version"));
  }

  install(editor: Editor): void {
    this.editor = editor;
  }

  destroy(): void {
    this.events.clear();
    this.editor = undefined;
  }

  private requireEditor(): Editor {
    if (!this.editor) {
      throw new VersioningError(
        "VERSIONING_NOT_INSTALLED",
        "This Versioning instance has not been installed on an editor yet. Call editor.use(versioning) before creating, listing, or restoring versions.",
      );
    }
    return this.editor;
  }

  /** Runs one of the adapter's three methods, normalizing any failure (network error, adapter bug, ...) into a VersioningError. */
  private async callAdapter<T>(op: string, fn: () => Promise<T> | T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new VersioningError("VERSIONING_ADAPTER_ERROR", `The version adapter's ${op}() failed.`, {
        cause: error,
        context: { documentId: this.documentId, op },
      });
    }
  }

  /**
   * Snapshots the editor's current document as a new, permanent version.
   * Does not touch the live document, the undo/redo history, or any
   * previously saved version.
   */
  async createVersion(options: CreateVersionOptions = {}): Promise<DocumentVersion> {
    const editor = this.requireEditor();

    const draft: Omit<DocumentVersion, "number"> = {
      id: this.idFactory(),
      document: editor.serialize(),
      createdAt: Date.now(),
      author: options.author ?? editor.clientId,
      label: options.label,
      metadata: options.metadata,
    };

    const version = await this.callAdapter("save", () => this.adapter.save(this.documentId, draft));
    this.events.emit("version.create", { version });
    return version;
  }

  /** Every version saved for this document, oldest first. */
  async listVersions(): Promise<DocumentVersion[]> {
    this.requireEditor();
    const versions = await this.callAdapter("list", () => this.adapter.list(this.documentId));
    return [...versions].sort((a, b) => a.number - b.number);
  }

  async getVersion(versionId: string): Promise<DocumentVersion | undefined> {
    this.requireEditor();
    return await this.callAdapter("get", () => this.adapter.get(this.documentId, versionId));
  }

  /**
   * Loads a past version's document into the live editor (via
   * `editor.load()`, so schema migration runs exactly as it would for any
   * other loaded document) — a rollback, not a history rewrite. By default
   * this also records a brand-new version capturing the restored content
   * (see `RestoreVersionOptions.recordRestore`), so `listVersions()` always
   * reflects everything that ever happened, in order, with nothing deleted.
   *
   * Always emits `"version.restore"`, whether or not a new version was
   * recorded — the live document changed either way.
   */
  async restoreVersion(versionId: string, options: RestoreVersionOptions = {}): Promise<RestoreResult> {
    const editor = this.requireEditor();
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new VersioningError(
        "VERSIONING_VERSION_NOT_FOUND",
        `No version "${versionId}" exists for document "${this.documentId}". Check the id came from listVersions()/getVersion() on this same document.`,
        { context: { versionId, documentId: this.documentId } },
      );
    }

    try {
      editor.load(version.document);
    } catch (error) {
      throw new VersioningError(
        "VERSIONING_RESTORE_FAILED",
        `Failed to load version "${versionId}" into the editor.`,
        { cause: error, context: { versionId, documentId: this.documentId } },
      );
    }

    // The live document has now genuinely changed, regardless of what
    // happens below — editor.load() above already succeeded. If recording
    // the restore fails, that must not read as "the restore failed": the
    // event still fires (so a UI reflects what's actually on screen) and the
    // thrown error says explicitly that the live document already moved.
    let recordedVersion: DocumentVersion | undefined;
    if (options.recordRestore !== false) {
      try {
        recordedVersion = await this.createVersion({
          label: options.label ?? `Restored from version ${version.number}`,
          metadata: { restoredFrom: version.id },
        });
      } catch (error) {
        this.events.emit("version.restore", { restoredFrom: version, recordedVersion: undefined });
        throw new VersioningError(
          "VERSIONING_ADAPTER_ERROR",
          `Restored version ${version.number} into the live editor, but failed to record a new ` +
            `version capturing the restore — the live document has already changed even though ` +
            `this call is rejecting.`,
          { cause: error, context: { documentId: this.documentId, versionId } },
        );
      }
    }

    const result: RestoreResult = { restoredFrom: version, recordedVersion };
    this.events.emit("version.restore", result);
    return result;
  }
}
