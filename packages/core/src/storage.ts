import { EugineError } from "./errors.js";
import type { DocumentStore } from "./document.js";
import type { EugineDocument, SerializedDocument } from "./types.js";

export interface StorageAdapter {
  save(document: SerializedDocument, id?: string): Promise<void> | void;
  load(id?: string): Promise<SerializedDocument | undefined> | SerializedDocument | undefined;
}

/** Non-persistent adapter, useful for tests and quick prototyping. */
export class MemoryStorageAdapter implements StorageAdapter {
  private documents = new Map<string, SerializedDocument>();

  save(document: SerializedDocument, id = "default"): void {
    this.documents.set(id, document);
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

  async save(document: SerializedDocument, id?: string): Promise<void> {
    if (!this.adapter) {
      throw new EugineError("EUGINE_PLUGIN_ERROR", "No storage adapter configured. Call editor.storage.use(adapter) first.");
    }
    await this.adapter.save(document, id);
  }

  async load(id?: string): Promise<SerializedDocument | undefined> {
    if (!this.adapter) {
      throw new EugineError("EUGINE_PLUGIN_ERROR", "No storage adapter configured. Call editor.storage.use(adapter) first.");
    }
    return await this.adapter.load(id);
  }
}

export interface AutosaveOptions {
  debounceMs?: number;
  onSave?: (document: EugineDocument) => void;
  onError?: (error: unknown) => void;
}

/**
 * Wires document changes to a save function through a debounce, per the
 * PRD's "Document Change → Debounce → Storage Adapter → API" autosave
 * architecture. Returns a disposer that stops watching.
 */
export function createAutosave(
  store: DocumentStore,
  save: (document: EugineDocument) => Promise<void> | void,
  options: AutosaveOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = store.onChange(({ document }) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      Promise.resolve(save(document))
        .then(() => options.onSave?.(document))
        .catch((error: unknown) => options.onError?.(error));
    }, debounceMs);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
