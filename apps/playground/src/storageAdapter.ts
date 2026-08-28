import type { SerializedDocument, StorageAdapter } from "eugine";

const KEY_PREFIX = "eugine-playground:";

/** A minimal, real StorageAdapter implementation — Eugine ships none by design. */
export class LocalStorageAdapter implements StorageAdapter {
  save(document: SerializedDocument, id = "default"): void {
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(document));
  }

  load(id = "default"): SerializedDocument | undefined {
    const raw = window.localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as SerializedDocument) : undefined;
  }
}
