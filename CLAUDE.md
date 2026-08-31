# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Eugine is an engine for building drag-and-drop visual editors/page builders — not a finished
builder itself. It provides the document model, component registry, command/history system, and
rendering layer; host applications build their own editor UI on top. `PRD.md` at the repo root is
the full product spec; this implementation deliberately covers only the MVP subset defined in
PRD §116 (document engine, registry, commands, history, events, serialization, selection, DOM
renderer, server-safe HTML renderer). Collaboration, a React renderer/Next.js adapter, templates,
asset management, and AI integration are explicitly deferred (PRD §117–120) and not implemented.

## Commands

npm workspaces monorepo (not pnpm/yarn). Run from the repo root, or `cd packages/<name>` to scope
to one package.

```bash
npm install         # installs and links all workspace packages
npm run build        # tsup build (ESM + CJS + .d.ts) for every package
npm run test          # vitest run for every package
npm run typecheck     # tsc --noEmit for every package
npm run clean         # remove dist/ in every package
```

There is no lint script configured yet (`npm run lint` is a no-op — no package defines it).

Run a single test file or pattern by cd'ing into the package first (each package has its own
`vitest.config.ts` and test environment):

```bash
cd packages/core && npx vitest run tests/history.test.ts
cd packages/core && npx vitest run -t "undo"
```

First-time setup on a new machine may require approving esbuild's postinstall script (used by
tsup/vitest): `npm install-scripts approve esbuild@<version>` — already pre-approved in this
repo's `package.json` `allowScripts` field, but re-approve if npm complains after a version bump.

Before publishing/packaging changes, validate contents with `npm pack --dry-run -w <package>`
(see `.github/workflows/ci.yml` for the exact gate order: build → typecheck → test → pack).

**Build must run before typecheck, always — in CI and locally.** Every package resolves its
siblings (e.g. `@eugine/renderer` importing `@eugine/core`) through the consumed package's
`"types"` field, which points at `./dist/index.d.ts` — a build output, not the source. On a fresh
clone (or after `npm run clean`), running `tsc --noEmit` before a build fails with `Cannot find
module '@eugine/core'`. The root `build` script accounts for this internally too: `@eugine/eugine`
re-exports `@eugine/renderer`/`@eugine/renderer-server`, so building it before those two exist
fails the same way — npm workspaces otherwise iterate packages alphabetically, not in dependency
order, so `build` explicitly lists packages via repeated `-w` flags in dependency order (core →
renderer/renderer-server → eugine → apps/examples) instead of a plain `--workspaces` sweep. If you
add a new workspace package, add it to that explicit list in the correct position — a bare
`--workspaces --if-present` will silently reintroduce this failure mode for anything that depends
on another workspace package.

**The effective minimum Node version is set by the strictest workspace member, not the root
`engines` field alone.** The `@eugine/*` library packages support Node >=18.18, but `examples/*`
and `apps/docs` are Next.js 16 apps that require Node >=20.9 and fail `next build` outright on
older Node — since
`npm run build`/`npm run typecheck` run across every workspace, the CI matrix (and anyone running
these scripts locally) needs Node >=20.9 for the whole repo to build clean, even though individual
`@eugine/*` packages remain installable on Node 18 elsewhere. If you add a workspace with a
stricter Node requirement, bump the CI matrix in `.github/workflows/ci.yml` accordingly.

## Documentation site (`apps/docs`)

Next.js 16 + Fumadocs, deployed on Vercel (`apps/docs/vercel.json` carries the build settings, so
they are not dashboard-only). It consumes `eugine` through the workspace symlink, which is the
whole reason it lives in this repo rather than a separate one — examples run against the working
tree, not a published release.

Two pieces are load-bearing and easy to break:

- **Code snippets are never pasted into MDX.** They are read out of real `.ts` files in
  `apps/docs/src/examples/` by the `<CodeFromFile file="..." region="..." />` server component,
  which slices `// #region <id>` blocks. Those files are covered by `tsc --noEmit`, so changing a
  signature in `packages/core` fails `npm run typecheck` instead of leaving the docs quietly
  wrong. Verify the guard still works by breaking an example on purpose.
- **`content/docs/api/` is generated and gitignored.** `npm run api -w docs` runs TypeDoc and then
  `scripts/api-frontmatter.mjs`, which lifts each page's `# H1` into frontmatter `title` (Fumadocs
  rejects a page without one, and would otherwise render the heading twice) and writes a collapsed
  `meta.json` per directory. Never edit those files by hand.

A JSDoc comment in library source that contains an unfenced `{` becomes an MDX parse error once
TypeDoc emits it — fence code examples in doc comments (see `SELECTED_ATTRIBUTE` in
`packages/renderer/src/dom.ts`).

## Package graph

```
@eugine/core  (no deps; no DOM/React)
   ├─ @eugine/renderer          (browser DOM renderer)
   ├─ @eugine/renderer-server   (SSR-safe HTML renderer)
   ├─ @eugine/versioning        (persistent document versions — a plugin, not a core feature)
   └─ eugine                    (re-exports core; eugine/renderer, eugine/server, eugine/versioning subpaths)
```

`eugine` is the package most consumers install; `@eugine/*` packages can be used standalone.
Every package builds both ESM and CJS with an explicit `exports` map — there's no default-export
ambiguity to worry about, and workspace-internal deps resolve via npm symlinks without needing a
publish. Adding a new workspace package that other packages depend on means adding it to the
explicit `-w` list in the root `build`/`build:docs` scripts, in dependency order — see the note in
the Commands section above.

**`@eugine/versioning` is intentionally not part of `@eugine/core`.** The PRD (§75) is explicit:
persistent document versions ("Draft v12" / "Published v10", with rollback) should "remain outside
the core unless a dedicated plugin provides it" — this is a different concept from `History`
(in-session undo/redo, ephemeral, cleared on `editor.load()`). `Versioning` installs via
`editor.use(...)` (the `EuginePlugin` lifecycle in `packages/core/src/plugin.ts` — install →
initialize → ready → destroy) and stores full `SerializedDocument` snapshots through a
host-supplied `VersionAdapter`, so restoring an old version runs through the editor's normal
`load()`/`MigrationRegistry` path rather than a separate one this package would have to keep in
sync. Versions are append-only by design — the package never overwrites or deletes one, including
on rollback (`restoreVersion()` loads the old content *and* records a new version on top of it).

## Core architecture (`packages/core/src`)

**Document model is flat, not nested.** `EugineDocument = { schemaVersion, rootId, nodes: Record<id, EugineNode> }`.
Every tree operation in `tree.ts` (insert/remove/move/duplicate/wrap/unwrap/reorder/etc.) takes a
document and returns a *new* document, but only shallow-copies the top-level `nodes` map and
replaces the specific entries it touches — every untouched node keeps the exact same object
reference across the operation. This reference equality is not incidental: `packages/renderer`'s
`dom.ts` relies on it to decide which DOM nodes need to be rebuilt on `update()` (if
`previousNode === node`, skip rebuilding and just recurse into children). Any new tree operation
must preserve this "only touched nodes get new object identity" property or the DOM renderer's
incremental update will silently stop being incremental (still correct, just no longer localized).

**Commands + History, not direct mutation.** Every document mutation is a `Command` object
(`commands/*.ts`, each with `execute(store)`/`undo(store)`) rather than a plain function call.
`History` (`history.ts`) wraps command execution in transactions so a multi-step editor action
(e.g. a drag = detach + reattach + reindex) becomes exactly one undo step — see
`history.transaction(fn)`. `Editor` (`editor.ts`) is the public facade: it validates drop rules
against the `ComponentRegistry` *before* constructing a command, then calls `history.execute(...)`.
If you add a new mutating editor method, follow that same order (validate → build command →
`history.execute`) so undo/redo and events stay consistent.

**Undo computes inverses; it never restores snapshots.** This is a hard invariant, not a style
preference. A command's `undo()` must derive its inverse against the document *as it is at undo
time* and must touch only what that command touched — `UpdatePropsCommand` restores exactly the
keys it wrote (see `invertPatch()` in `tree.ts`) rather than putting back a captured `props`
object; `RemoveNodeCommand` restores with `overwriteExisting: false`; `ReorderChildrenCommand`
undoes with `{ strict: false }` so a changed child set reconciles instead of throwing. Restoring a
snapshot also reverts everything that happened after it was captured, which in a session with two
authors means silently deleting the other person's work. A command's `undo()` must also tolerate
its target being gone (another client removed it) — that's a no-op, not an error. There are
regression tests for each of these in `packages/core/tests/collaboration-gaps.test.ts`; if you add
a command, add one there too.

**Replaying a transaction is atomic.** `History.undo()/redo()` pop the transaction only *after* the
replay succeeds, and roll the document back to its pre-replay state if any command throws
(wrapping the cause in `EUGINE_HISTORY_ERROR`). Do not "simplify" this back to popping first — the
original code left the document half-reverted and dropped the transaction from both stacks, putting
the user's edit permanently out of reach of undo and redo alike.

**Collaboration seams.** Commands serialize to `EugineOperation` (`operations.ts`) via
`toOperation()`; `history.onCommit()` emits them per transaction. Remote operations come in through
`editor.applyRemote()`, which bypasses history entirely — a remote edit must never land on the
local undo stack. `DocumentStore` carries a monotonic `revision` and `editor.save()` sends it as
`baseRevision` so adapters can reject a stale overwrite. If you add a mutating command, implement
`toOperation()` on it (returning the ids it actually created, so every client agrees on node
identity) and add the matching case to `applyOperation()`, or transactions containing it become
untransmittable.

**Implicit root component.** `createEditor()` auto-registers a permissive (`accepts: "*"`)
component definition for whatever type the document's root node has, unless the host already
registered one explicitly (see the constructor in `editor.ts`). Without this, `editor.insert()`
into a fresh document throws `EUGINE_COMPONENT_NOT_REGISTERED` because the root's `type` (`"root"`)
was never registered — this was a real bug caught during initial implementation; don't remove the
fallback without re-checking `createEditor()` still works with zero registered components.

**Events fire in a specific order.** `DocumentStore.set()` emits `document.change` synchronously
*inside* `history.execute()` (from the command mutating the store), before `Editor` emits its own
higher-level event (e.g. `node.create`). If you're asserting on event ordering in tests, the store
event always precedes the editor-level event for the same operation.

**Errors** are all `EugineError` instances with a stable `code` (see `errors.ts` for the full list)
— branch on `.code`, not on the message string.

## Renderer split (`packages/renderer` vs `packages/renderer-server`)

These are deliberately separate packages, not one package with two entry points, because the PRD
treats "editor runtime" and "renderer runtime" as different deployment targets (PRD §38/§71).
`renderer-server`'s `tsconfig.json` excludes the `DOM` lib entirely — this is a compile-time
guardrail, not just a convention, so importing any `window`/`document`/browser API there is a type
error, not just a lint warning.

The two renderers use **incompatible** component-renderer function shapes
(`HtmlComponentRenderer` returns a string; `DomComponentRenderer` returns a `Node`), so you
instantiate a separate `ComponentRegistry<T>` per renderer context — the same `EugineDocument` can
be fed to both, but component definitions registered for one aren't usable by the other. Both
renderers resolve `node.type` strictly via `registry.tryGet()`/`registry.get()` and never
dynamically import anything named inside document data — this is the security boundary described
in PRD §61–63; preserve it in any new renderer.

`@eugine/renderer`'s `dom.ts` update algorithm: reconcile walks the tree, reuses a node's cached
DOM element when `previousNode === node` (recursing into children regardless, since a changed
descendant patches itself into the live DOM via `replaceChild`/`replaceWith` without needing its
ancestors to rebuild), and garbage-collects the element cache for ids no longer visited.

## Testing conventions

- `packages/core`, `packages/renderer-server`, and `packages/versioning`: vitest `environment: "node"`.
- `packages/renderer` and `packages/eugine`: vitest `environment: "jsdom"` (needs the `jsdom`
  devDependency; DOM assertions and `document.createElement` work directly in tests).
- `packages/core/tests/invariants.test.ts` runs randomized sequences of editor operations (seeded
  PRNG, not `Math.random()`, for reproducibility) and asserts `validateDocument()` holds after
  every step, then that undo-to-empty and redo-forward both stay valid — this is the place to add
  new invariant checks rather than one-off unit tests when testing tree/history correctness broadly.
- `packages/eugine/tests/integration.test.ts` is the cross-package smoke test: builds a document
  through the editor, then asserts the server-HTML and DOM-render outputs are equal. Update this
  test if you change the shape either renderer expects from a component definition.
