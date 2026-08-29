import { EugineError } from "./errors.js";
import type { DocumentStore } from "./document.js";
import { documentRevision, type EugineDocument, type SerializedDocument } from "./types.js";

export interface SaveOptions {
  /** Which document to write, for adapters that hold more than one. */
  id?: string;
  /**
   * The revision this save is based on — `editor.store.getRevision()` at the
   * moment the document was serialized.
   *
   * An adapter that honours it rejects the write when the stored document has
   * moved on since, turning the single worst failure in a shared editor —
   * one user's whole session silently overwritten by another's autosave — into
   * a conflict the host can surface and recover from. Adapters are free to
   * ignore it, but then two clients editing one page remain last-write-wins.
   */
  baseRevision?: number;
}

export type SaveResult =
  | { ok: true; revision?: number }
  | {
      ok: false;
      reason: "conflict";
      /** The stored document that won, so the host can diff, merge, or prompt. */
      current?: SerializedDocument;
    };

export interface StorageAdapter {
  /**
   * Persists the document. Returning nothing is treated as success, so a
   * trivial adapter stays trivial; return a SaveResult to report a conflict.
   */
  save(document: SerializedDocument, options?: SaveOptions): Promise<SaveResult | void> | SaveResult | void;
  load(id?: string): Promise<SerializedDocument | undefined> | SerializedDocument | undefined;
}

/**
 * Non-persistent adapter, useful for tests and quick prototyping — and a
 * reference implementation of optimistic concurrency: it rejects a write
 * whose `baseRevision` is behind what it already holds.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private documents = new Map<string, SerializedDocument>();

  save(document: SerializedDocument, options: SaveOptions = {}): SaveResult {
    const id = options.id ?? "default";
    const stored = this.documents.get(id);

    if (stored && options.baseRevision !== undefined) {
      const storedRevision = documentRevision(stored.document);
      if (storedRevision > options.baseRevision) {
        return { ok: false, reason: "conflict", current: stored };
      }
    }

    this.documents.set(id, document);
    return { ok: true, revision: documentRevision(document.document) };
  }

  load(id = "default"): SerializedDocument | undefined {
    return this.documents.get(id);
  }
}

/**
 * Eugine does not assume where projects are stored — hosts plug in
 * localStorage, IndexedDB, a REST/GraphQL API, or anything else that
 * implements StorageAdapter.
 */
export class StorageManager {
  private adapter: StorageAdapter | null = null;

  use(adapter: StorageAdapter): void {
    this.adapter = adapter;
  }

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  private require(): StorageAdapter {
    if (!this.adapter) {
      throw new EugineError(
        "EUGINE_PLUGIN_ERROR",
        "No storage adapter configured. Call editor.storage.use(adapter) first.",
      );
    }
    return this.adapter;
  }

  async save(document: SerializedDocument, options: SaveOptions = {}): Promise<SaveResult> {
    const result = await this.require().save(document, options);
    // An adapter that returns nothing is reporting plain success.
    return result ?? { ok: true };
  }

  async load(id?: string): Promise<SerializedDocument | undefined> {
    return await this.require().load(id);
  }
}

export interface AutosaveOptions {
  debounceMs?: number;
  onSave?: (document: EugineDocument) => void;
  onError?: (error: unknown) => void;
  /**
   * Whether stopping the autosave writes any still-pending change instead of
   * throwing it away. Defaults to true.
   *
   * The old behaviour was to discard: wiring the disposer to a plugin's
   * `destroy()` or a component unmount — the normal thing to do — meant
   * closing the editor inside the debounce window silently dropped the user's
   * last edit. Set this to false only if you genuinely want that.
   */
  flushOnStop?: boolean;
}

/**
 * Callable for backwards compatibility — `stop()` still stops the autosave —
 * with the pieces a host needs to guarantee nothing is lost on the way out.
 */
export interface AutosaveHandle {
  (): void;
  /** Writes any pending change now. Await this in a beforeunload/unmount path. */
  flush(): Promise<void>;
  /** Stops watching. Flushes pending work unless told otherwise. */
  stop(options?: { flush?: boolean }): Promise<void>;
  /** True when a change is waiting for the debounce to elapse. */
  isPending(): boolean;
}

/**
 * Wires document changes to a save function through a debounce, per the
 * PRD's "Document Change → Debounce → Storage Adapter → API" autosave
 * architecture.
 */
export function createAutosave(
  store: DocumentStore,
  save: (document: EugineDocument) => Promise<void> | void,
  options: AutosaveOptions = {},
): AutosaveHandle {
  const debounceMs = options.debounceMs ?? 1000;
  const flushOnStop = options.flushOnStop ?? true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: EugineDocument | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function write(document: EugineDocument): Promise<void> {
    pending = null;
    inFlight = Promise.resolve(save(document))
      .then(() => options.onSave?.(document))
      .catch((error: unknown) => options.onError?.(error));
    return inFlight;
  }

  async function flush(): Promise<void> {
    clearTimer();
    const document = pending;
    if (document) await write(document);
    await inFlight;
  }

  const unsubscribe = store.onChange(({ document }) => {
    pending = document;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void write(document);
    }, debounceMs);
  });

  async function stop({ flush: shouldFlush = flushOnStop } = {}): Promise<void> {
    unsubscribe();
    if (shouldFlush) {
      await flush();
      return;
    }
    clearTimer();
    pending = null;
  }

  const handle = (() => {
    void stop();
  }) as AutosaveHandle;

  handle.flush = flush;
  handle.stop = stop;
  handle.isPending = () => pending !== null;

  return handle;
}
