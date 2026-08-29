import { NextResponse } from "next/server";
import { documentRevision, isSerializedDocument } from "eugine";
import { getPublishedDocument, setPublishedDocument } from "@/lib/store";

/**
 * A real StorageAdapter backend, reached over HTTP by lib/apiStorageAdapter.ts —
 * as opposed to the getting-started example's absence of persistence, or the
 * playground app's localStorage adapter. This is the "REST API" storage
 * pattern from the PRD's Persona A/B (SaaS/CMS developers).
 */
export async function GET() {
  return NextResponse.json(getPublishedDocument());
}

export async function POST(request: Request) {
  // request.json() is typed `any` by TypeScript's own lib, and this is a
  // public endpoint — never trust that assertion, verify it. A request body
  // that isn't actually a Eugine document is rejected with 400 instead of
  // being stored as if it were one.
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { document, baseRevision } = body as { document?: unknown; baseRevision?: unknown };
  if (!isSerializedDocument(document)) {
    return NextResponse.json({ error: "Request body is not a valid Eugine document." }, { status: 400 });
  }

  // Optimistic concurrency. Without this check the endpoint is a plain
  // last-write-wins overwrite: two people editing the same page means whoever
  // saves second silently erases the other's entire session. Rejecting the
  // stale write turns that into something the editor can recover from.
  const stored = getPublishedDocument();
  if (stored && typeof baseRevision === "number" && documentRevision(stored.document) > baseRevision) {
    return NextResponse.json(
      { error: "The stored document has changed since this edit began.", current: stored },
      { status: 409 },
    );
  }

  setPublishedDocument(document);
  return NextResponse.json({ ok: true, revision: documentRevision(document.document) });
}
