# Eugine

**An extensible engine for building drag-and-drop visual editors and page builders.**

Eugine is not a complete website builder. It's the infrastructure a website builder, email
builder, CMS editor, dashboard builder, or form builder is built *on top of* — a document model,
component registry, command/history system, and rendering architecture — so you don't have to
implement drag-and-drop, undo/redo, serialization and rendering from scratch.

> Eugine gives developers the engine. Developers build the editor.

This repository implements the MVP scope defined in [`PRD.md`](./PRD.md) §116: the document
engine, component registry, commands, history, events, serialization, selection state, and both a
browser DOM renderer and a server-safe HTML renderer. Real-time collaboration, a React
renderer/adapter, storage-backed autosave wiring beyond the primitive, templates, and AI
integration are explicitly out of scope for this release (PRD §117–120) and are left for later
phases.

## Packages

This is an npm workspaces monorepo:

| Package | What it is |
| --- | --- |
| [`eugine`](./packages/eugine) | Convenience package: re-exports `@eugine/core`, plus `eugine/renderer`, `eugine/server`, and `eugine/versioning` subpaths. This is what most apps install. |
| [`@eugine/core`](./packages/core) | The engine: document model, component registry, commands, history, selection, serialization, plugin system, storage adapter interface. No DOM, no React. |
| [`@eugine/renderer`](./packages/renderer) | Browser DOM renderer with localized (per-node) incremental updates. |
| [`@eugine/renderer-server`](./packages/renderer-server) | Deterministic HTML string renderer with zero browser API dependencies — safe for Next.js Server Components and other SSR contexts. |
| [`@eugine/versioning`](./packages/versioning) | Optional plugin for persistent, durable document versions (create/list/roll back) — separate from in-session undo/redo. |

Each package builds to ESM + CJS with full TypeScript declarations and an explicit `exports` map
(no default-export ambiguity), and can be depended on independently.

## Why a document model, not just HTML

The single most important architectural rule in this codebase (PRD §10, §143):

> **The document model must not depend on the editor UI.**

An `EugineDocument` is a plain, JSON-serializable tree (flat, keyed by node id, so structural
updates only touch the nodes they actually change). It never contains editor-only state —
selection, viewport, drag state, open panels — only persisted content: node types, props, styles,
class names and structure. That's what makes `@eugine/renderer-server` able to turn a document
into HTML with no editor runtime, no `window`/`document`/`localStorage`, and a fully deterministic
output for identical input.

Component types are resolved strictly against a `ComponentRegistry` you build — a renderer never
dynamically imports or executes anything named inside a document. That registry is the security
boundary described in PRD §61–63: untrusted document JSON is data, never code.

## Getting started

```bash
npm install eugine
```

```ts
import { createEditor } from "eugine";

const editor = createEditor({
  components: [
    { type: "section", accepts: "*" },
    { type: "text", accepts: "none", defaults: { props: { content: "Hello world" } } },
  ],
});

const heroId = editor.insert("section", editor.getDocument().rootId);
editor.insert("text", heroId);

editor.updateProps(heroId, { className: "hero" });
editor.history.undo();
editor.history.redo();

const json = editor.serialize(); // { schemaVersion, engine: "eugine", engineVersion, document }
editor.load(json);
```

Render the same document two ways from a shared registry contract:

```ts
import { ComponentRegistry } from "@eugine/core";
import { renderToDom } from "eugine/renderer";     // browser
import { renderToString } from "eugine/server";    // Node / SSR, no editor runtime required
```

See each package's README for the full API and more examples.

## Repository layout

```text
eugine/
├── PRD.md                    product requirements this implementation targets
├── packages/
│   ├── core/                  @eugine/core   — document model, registry, commands, history
│   ├── renderer/               @eugine/renderer        — browser DOM renderer
│   ├── renderer-server/        @eugine/renderer-server  — SSR-safe HTML renderer
│   ├── versioning/             @eugine/versioning       — persistent document versions (plugin)
│   └── eugine/                 eugine                  — convenience re-export package
├── package.json                workspace root
└── tsconfig.base.json          shared TypeScript config
```

## Development

```bash
npm install       # install all workspace dependencies
npm run build     # build every package (tsup: ESM + CJS + .d.ts)
npm run test      # run every package's vitest suite
npm run typecheck # tsc --noEmit across every package
```

Each package also has its own `build`/`test`/`typecheck`/`clean` scripts you can run from inside
`packages/<name>`.

### Quality gates before publishing

Per PRD §84/§132, before publishing any package: build, typecheck, unit + integration tests must
pass, and `npm pack --dry-run` should be inspected for each package to confirm only `dist/`,
`package.json`, `README.md` and `LICENSE` are included.

## Design principles this codebase follows

From PRD §127/§143 — the non-negotiables:

1. Core is not coupled to any UI or framework.
2. The document model is the source of truth; JSON is the canonical persisted format, HTML is an
   output format.
3. Rendering is separable from editing — a renderer never requires drag-and-drop, history,
   selection, or editor panels.
4. SSR never imports browser APIs.
5. History is transaction-aware: a multi-step user action (e.g. a drag) is one undo step, not many.
6. Unknown/untrusted document content is never executed — only ever resolved through the component
   registry.
7. Document schemas are versioned; migrations are explicit, deterministic functions.
8. Editor state (selection, viewport, drag state) is never part of the persisted document.

## License

MIT
