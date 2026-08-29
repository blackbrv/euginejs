import { isSerializedDocument, type SerializedDocument, type StorageAdapter } from "eugine";

const KEY_PREFIX = "eugine-playground:";

/** A minimal, real StorageAdapter implementation — Eugine ships none by design. */
export class LocalStorageAdapter implements StorageAdapter {
  save(document: SerializedDocument, id = "default"): void {
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(document));
  }

  load(id = "default"): SerializedDocument | undefined {
    const raw = window.localStorage.getItem(KEY_PREFIX + id);
    if (!raw) return undefined;

    // JSON.parse() is typed `any` by TypeScript's own lib — isSerializedDocument
    // actually verifies the shape instead of blindly trusting that assertion,
    // so a stale/corrupted localStorage entry from an older app version fails
    // loudly here instead of crashing deeper inside the editor.
    const parsed: unknown = JSON.parse(raw);
    if (!isSerializedDocument(parsed)) {
      console.warn(`[playground] localStorage entry "${id}" is not a valid Eugine document; ignoring it.`);
      return undefined;
    }
    return parsed;
  }
}
