import type { SerializedDocument, StorageAdapter } from "eugine";

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
    const data = (await res.json()) as SerializedDocument | null;
    return data ?? undefined;
  }
}
