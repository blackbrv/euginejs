import { NextResponse } from "next/server";
import type { SerializedDocument } from "eugine";
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
  const document = (await request.json()) as SerializedDocument;
  setPublishedDocument(document);
  return NextResponse.json({ ok: true });
}
