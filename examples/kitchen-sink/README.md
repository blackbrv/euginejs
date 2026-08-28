# Eugine + Next.js — Kitchen Sink

A comprehensive example exercising every MVP feature `eugine` ships:

- **Drag-and-drop** — from a component palette, and moving existing nodes, with nested drop-rule
  resolution (`grid` only accepts `card`, up to 4; `heading`/`text`/`button` accept none).
- **Commands** — insert, remove, move, duplicate, updateProps, wrap/unwrap (buttons in the
  inspector), replace (used to toggle `locked`/`hidden`).
- **History** — undo/redo, plus a "Duplicate ×3 (1 undo)" button showing `editor.transaction()`
  grouping three `duplicate()` calls into a single undo step.
- **Selection** — click to select, shift-click to multi-select, "Delete selected" batch-removes
  everything currently selected in one transaction.
- **Events** — a live log of `editor.events` (`node.create`, `node.delete`, `node.move`,
  `history.undo`/`redo`, `document.load`).
- **Plugin system** — `lib/autosavePlugin.ts` is a real `EuginePlugin` (install/destroy hooks)
  wired through `editor.use()`, using core's `createAutosave` helper.
- **Component flags** — `locked` (blocks move/delete) and `hidden` (excluded from render output),
  toggled from the layers panel.
- **Storage adapter** — `lib/apiStorageAdapter.ts` implements `StorageAdapter` over `fetch()`
  against a real Next.js Route Handler (`app/api/document/route.ts`), not just `localStorage`.
- **Editor Runtime ≠ Renderer Runtime** — the editor lives at `/`. Clicking "Publish" saves the
  document server-side; `/preview` is a separate Server Component that renders the published
  document with `renderToString()` from `eugine/server` — no editor JS on that route at all.

## Run it

```bash
npm install   # from the repo root, once
npm run dev -w example-kitchen-sink
```

Open http://localhost:3002 for the editor, build something, click **Publish**, then open
http://localhost:3002/preview in another tab.

> The "published" document lives in an in-memory module (`lib/store.ts`) for demo purposes — it
> resets when the dev server restarts. A real app would persist it to a database.
