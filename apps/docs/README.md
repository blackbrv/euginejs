# Eugine documentation site

Next.js 16 + [Fumadocs](https://fumadocs.dev), deployed on Vercel.

```bash
npm run build          # from the repo root — packages must be built first
npm run dev -w docs    # http://localhost:3003
```

## Why it lives in this repo

The docs consume `eugine` through the npm workspace symlink, so examples and live demos always
run against the working tree rather than a published release. That is also what lets
`npm run typecheck` fail when a documented example stops compiling.

## Layout

| Path | What it is |
| --- | --- |
| `content/docs/` | Hand-written MDX. Sidebar order comes from each folder's `meta.json`. |
| `content/docs/api/` | **Generated** by TypeDoc on `prebuild`. Gitignored — never edit by hand. |
| `src/examples/` | Real `.ts` files, compiled by `tsc --noEmit`. The source of every code block. |
| `src/demos/` | Small per-concept component registries for the live editors. |
| `src/components/` | `CodeFromFile` (snippet reader) and `EugineDemo` (mounts the DOM renderer). |

## Code examples are typechecked

A snippet is never pasted into MDX. It is read out of a compiled file:

```mdx
<CodeFromFile file="first-editor" region="insert" />
```

...backed by `src/examples/first-editor.ts`:

```ts
// #region insert
const heroId = editor.insert("section", root);
// #endregion insert
```

Change a signature in `packages/core` and the docs build fails, instead of the page quietly going
stale. To verify the guard still works, break an example on purpose and run `npm run typecheck`.

## Live demos

`renderToDom()` returns a vanilla DOM `Node`, so `EugineDemo` is a thin client component that owns
a container ref and the editor's lifetime — the same pattern documented under Guides → React.
Demo registries are deliberately minimal and are **not** copies of `apps/playground`'s schema.
