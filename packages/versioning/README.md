# @eugine/versioning

Persistent, durable document versions — "Draft v12" / "Published v10" — for a host that wants a
user to save named checkpoints and roll back to one later. This is **not** undo/redo: `History` in
`@eugine/core` is an in-session command stack that's cleared on `editor.load()` and gone on page
refresh; a `Versioning` version survives a refresh, a deploy, or a different editing session,
because it's written through a `VersionAdapter` you provide (a REST API, IndexedDB, a database —
anything).

```bash
npm install @eugine/versioning @eugine/core
```

```ts
import { createEditor } from "@eugine/core";
import { MemoryVersionAdapter, Versioning } from "@eugine/versioning";

const editor = createEditor();
const versioning = new Versioning({ adapter: new MemoryVersionAdapter(), documentId: "home-page" });
editor.use(versioning);

// ... the user edits ...
const v1 = await versioning.createVersion({ label: "First draft" });

// ... more edits ...
await versioning.createVersion({ label: "Published" });

// Later: list every version, oldest first.
const versions = await versioning.listVersions();

// Roll back. This loads v1's document into the live editor and, by default,
// records a brand-new version capturing the restore — nothing already saved
// is ever deleted, overwritten, or renumbered.
await versioning.restoreVersion(v1.id);
```

## Why a separate package

The PRD is explicit about this: "Version management itself should remain outside the core unless a
dedicated plugin provides it." `Versioning` installs onto an `Editor` as a plugin
(`editor.use(...)`) rather than living in `@eugine/core`, so a host that doesn't need persistent
versions pays nothing for this feature — no extra dependency, no extra API surface on `Editor`
itself.

## Bring your own storage

`VersionAdapter` has three methods — `save`, `list`, `get` — and, unlike `@eugine/core`'s
`StorageAdapter` (which holds one current document and is free to overwrite it), **must never
overwrite or delete an existing version**. `Versioning` assigns each version's id and content;
**your adapter assigns the version `number`** and returns the saved version — that's deliberate,
not an oversight: only your backend can make "the next number" atomic for itself (a database
auto-increment column, a transactional read-modify-write, a unique constraint), which a generic
"list everything, then compute max + 1" in this package cannot be for every possible backend.
`MemoryVersionAdapter` is the in-process reference implementation (numbering from the last entry in
its own array, with no `await` in between, so concurrent `createVersion()` calls in one process
never race) — useful for tests and prototyping, and a model for a real one.

## Schema migration

Each `DocumentVersion.document` is a full `SerializedDocument` envelope (the same shape
`editor.serialize()`/`editor.load()` use), so restoring a version saved under an older
`schemaVersion` runs through the exact same `MigrationRegistry` your editor is already configured
with — there is no separate migration path to maintain for version history.

## What this package intentionally does not do

- **No automatic/periodic versioning.** `createVersion()` is an explicit action — wire it to a
  "Save version" or "Publish" button, or your own timer, rather than calling it on every edit.
- **No pruning/retention policy.** Old versions are never deleted by this package; if you want to
  cap how many versions are kept, enforce that in your own `VersionAdapter`.
- **No diffing.** Two versions are both plain `SerializedDocument` values — diff them however suits
  your UI.
