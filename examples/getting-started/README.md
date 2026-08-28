# Eugine + Next.js — Getting Started

The smallest possible Eugine + Next.js integration, showing the two halves of the architecture:

- **`/`** — a Server Component that calls `renderToString()` from `eugine/server` directly. No
  editor runtime, no client JavaScript for Eugine at all. This is what a published page looks like.
- **`/editor`** — a Client Component (`"use client"`) that mounts `createEditor()` from `eugine`
  and `renderToDom()` from `eugine/renderer` into a plain DOM ref, with a couple of buttons and a
  live `editor.serialize()` JSON view.

## Run it

```bash
npm install   # from the repo root, once
npm run dev -w example-getting-started
```

Then open http://localhost:3001.

## Where to look

- `lib/document.ts` — the shared component definitions and a sample `EugineDocument`, standing in
  for "a document fetched from your API".
- `lib/htmlRegistry.ts` — the `ComponentRegistry<HtmlComponentRenderer>` used only by the server
  page.
- `app/editor/page.tsx` — the client registry (`ComponentRegistry<DomComponentRenderer>`) and the
  `useEffect` that mounts/tears down the DOM renderer.
