import { isSerializedDocument, type SerializedDocument, type StorageAdapter } from "eugine";

/** A real StorageAdapter implementation talking to app/api/document/route.ts over fetch. */
export class ApiStorageAdapter implements StorageAdapter {
  async save(document: SerializedDocument): Promise<void> {
    const res = await fetch("/api/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    });
    if (!res.ok) throw new Error(`Failed to publish document: ${res.status}`);
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
