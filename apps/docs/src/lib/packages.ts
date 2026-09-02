/**
 * Single source of truth for the package table shown on both the landing
 * page (src/app/page.tsx) and the docs introduction (content/docs/index.mdx,
 * via <PackageTable />) — one list to keep in sync with the package graph,
 * not two independently worded copies.
 */
export const PACKAGES = [
  {
    name: "eugine",
    desc: "Re-exports core, plus eugine/renderer, eugine/server, eugine/versioning. Most apps install this.",
  },
  {
    name: "@euginejs/core",
    desc: "Document model, registry, commands, history, selection, serialization, plugins.",
  },
  {
    name: "@euginejs/renderer",
    desc: "Browser DOM renderer with per-node incremental updates.",
  },
  {
    name: "@euginejs/renderer-server",
    desc: "Deterministic HTML string renderer, zero browser API dependencies.",
  },
  {
    name: "@euginejs/versioning",
    desc: "Optional plugin for persistent, durable document versions and rollback.",
  },
] as const;
