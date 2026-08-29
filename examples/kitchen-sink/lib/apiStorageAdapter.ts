import {
  isSerializedDocument,
  type SaveOptions,
  type SaveResult,
  type SerializedDocument,
  type StorageAdapter,
} from "eugine";

/** A real StorageAdapter implementation talking to app/api/document/route.ts over fetch. */
export class ApiStorageAdapter implements StorageAdapter {
  async save(document: SerializedDocument, options: SaveOptions = {}): Promise<SaveResult> {
    const res = await fetch("/api/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document, baseRevision: options.baseRevision }),
    });

    // 409 is the whole point of sending baseRevision: someone else saved after
    // the revision this document was based on, so publishing would erase their
    // work. Report it as a conflict the host can act on rather than a failure.
    if (res.status === 409) {
      const body: unknown = await res.json();
      const current =
        typeof body === "object" && body !== null && isSerializedDocument((body as { current?: unknown }).current)
          ? ((body as { current: SerializedDocument }).current)
          : undefined;
      return { ok: false, reason: "conflict", current };
    }

    if (!res.ok) throw new Error(`Failed to publish document: ${res.status}`);
    return { ok: true };
  }

  async load(): Promise<SerializedDocument | undefined> {
    const res = await fetch("/api/document");
    if (!res.ok) throw new Error(`Failed to load document: ${res.status}`);

    // Response.json() is typed `any` by TypeScript's own lib — verify the
    // shape instead of blindly asserting it, so a malformed/legacy payload
    // fails clearly here rather than surfacing as a confusing error deep
    // inside the editor.
    const data: unknown = await res.json();
    if (data === null) return undefined;
    if (!isSerializedDocument(data)) throw new Error("Server returned a payload that is not a valid Eugine document.");
    return data;
  }
}
