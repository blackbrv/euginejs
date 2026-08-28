import type { SerializedDocument } from "eugine";

/**
 * Stand-in for a database. A real host app would persist this in Postgres,
 * a KV store, etc. — see the PRD's StorageAdapter guidance: Eugine itself
 * has no opinion on where documents live, it just defines the interface.
 *
 * This is deliberately anchored on `globalThis` rather than a plain
 * module-scoped variable: Next.js compiles Route Handlers and Server
 * Component pages into separate bundle "layers", each with its own module
 * registry, so a `let` at the top of this file gets a distinct instance per
 * layer — `app/api/document/route.ts` and `app/preview/page.tsx` would
 * silently each see their own copy. `globalThis` is the one thing actually
 * shared process-wide across layers (the same trick used for the canonical
 * Next.js + Prisma client singleton).
 */
const store = globalThis as typeof globalThis & { __euginePublishedDocument?: SerializedDocument | null };

export function getPublishedDocument(): SerializedDocument | null {
  return store.__euginePublishedDocument ?? null;
}

export function setPublishedDocument(document: SerializedDocument): void {
  store.__euginePublishedDocument = document;
}
