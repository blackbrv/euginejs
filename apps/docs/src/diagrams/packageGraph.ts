import type { DiagramDefinition } from "./types";

export type NodeId =
  | "core"
  | "renderer"
  | "rendererServer"
  | "versioning"
  | "eugine";

export const packageGraphDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "core",
      label: "@eugine/core",
      description:
        "The document model, component registry, commands, history, events, and serialization. No dependencies; no DOM, no React.",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "renderer",
      label: "@eugine/renderer",
      description: "The browser DOM renderer. Imports @eugine/core, but only re-exports a subset.",
      x: -380,
      y: 190,
    },
    {
      id: "rendererServer",
      label: "@eugine/renderer-server",
      description:
        "The SSR-safe HTML renderer. Excludes the DOM lib from its TypeScript config.",
      x: -120,
      y: 190,
    },
    {
      id: "versioning",
      label: "@eugine/versioning",
      description:
        "Persistent document versions (Draft v12 / Published v10) — a plugin installed via editor.use(), not a core feature.",
      x: 140,
      y: 190,
    },
    {
      id: "eugine",
      label: "eugine",
      description:
        "The package most consumers install. Re-exports core and the renderer/renderer-server/versioning subpaths.",
      x: 0,
      y: 360,
      kind: "end",
    },
  ],
  edges: [
    { id: "renderer-core", from: "renderer", to: "core", label: "depends on" },
    { id: "rendererServer-core", from: "rendererServer", to: "core", label: "depends on" },
    { id: "versioning-core", from: "versioning", to: "core", label: "depends on" },
    { id: "eugine-core", from: "eugine", to: "core", label: "re-exports" },
    { id: "eugine-renderer", from: "eugine", to: "renderer", label: "re-exports" },
    { id: "eugine-rendererServer", from: "eugine", to: "rendererServer", label: "re-exports" },
    { id: "eugine-versioning", from: "eugine", to: "versioning", label: "re-exports" },
  ],
};
