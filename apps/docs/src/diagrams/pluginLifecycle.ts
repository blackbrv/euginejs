import type { DiagramDefinition } from "./types";

export type NodeId =
  | "install"
  | "initialize"
  | "ready"
  | "destroy"
  | "installThrows"
  | "rollback"
  | "pluginError";

export const pluginLifecycleDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "install",
      label: "install(editor)",
      description:
        "The plugin's install hook runs first. It may hold subscriptions or set up state (e.g. editor.events.on('node.select', …)).",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "initialize",
      label: "initialize(editor)",
      description: "Second lifecycle hook, run before the editor is fully ready.",
      x: 0,
      y: 160,
    },
    {
      id: "ready",
      label: "ready(editor)",
      description:
        "Called when the editor is ready to use. A plugin registered after the editor is already ready has ready() called immediately.",
      x: 0,
      y: 320,
    },
    {
      id: "destroy",
      label: "destroy(editor)",
      description:
        "Called when the editor is destroyed; release any subscriptions here.",
      x: 0,
      y: 480,
      kind: "end",
    },
    {
      id: "installThrows",
      label: "install throws",
      description:
        "If a plugin throws during install, it is rolled back out of the registry — no initialize or ready is reached.",
      x: 360,
      y: 0,
      kind: "error",
    },
    {
      id: "rollback",
      label: "plugin removed from registry",
      description: "The failing plugin is removed so it cannot leave partial state behind.",
      x: 360,
      y: 160,
    },
    {
      id: "pluginError",
      label: "EUGINE_PLUGIN_ERROR (original error as cause)",
      description:
        "The install failure is wrapped and rethrown, with the original error as cause.",
      x: 360,
      y: 320,
      kind: "end",
    },
  ],
  edges: [
    { id: "install-initialize", from: "install", to: "initialize" },
    { id: "initialize-ready", from: "initialize", to: "ready" },
    { id: "ready-destroy", from: "ready", to: "destroy" },
    { id: "install-installThrows", from: "install", to: "installThrows" },
    { id: "installThrows-rollback", from: "installThrows", to: "rollback" },
    { id: "rollback-pluginError", from: "rollback", to: "pluginError" },
  ],
  routes: [
    {
      id: "normal",
      label: "Normal lifecycle",
      nodeIds: ["install", "initialize", "ready", "destroy"],
      edgeIds: ["install-initialize", "initialize-ready", "ready-destroy"],
    },
    {
      id: "install-throws",
      label: "Install throws (rollback)",
      nodeIds: ["installThrows", "rollback", "pluginError"],
      edgeIds: ["install-installThrows", "installThrows-rollback", "rollback-pluginError"],
    },
    {
      id: "registered-late",
      label: "Registered late",
      nodeIds: ["install", "initialize", "ready"],
      edgeIds: ["install-initialize", "initialize-ready"],
    },
  ],
};
