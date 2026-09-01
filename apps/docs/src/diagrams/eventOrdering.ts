import type { DiagramDefinition } from "./types";

export type NodeId =
  | "mutation"
  | "storeSet"
  | "documentChange"
  | "editorEvent"
  | "listeners";

export const eventOrderingDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "mutation",
      label: "Command mutates the store",
      description:
        "A command's execute(store) runs inside history.execute() and writes to the DocumentStore.",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "storeSet",
      label: "DocumentStore.set()",
      description:
        "Writes the new (shallow-copied) document and advances the revision counter. validateDocument() runs on every write.",
      x: 0,
      y: 140,
    },
    {
      id: "documentChange",
      label: "document.change fires (synchronous, inside history.execute)",
      description:
        "Emitted synchronously before the editor-level event. Selection is pruned before it fires, so listeners never see a stale id.",
      x: 0,
      y: 280,
    },
    {
      id: "editorEvent",
      label: "Editor emits its own higher-level event (e.g. node.create)",
      description:
        "Emitted after the store event by the Editor, describing the semantic operation (create/delete/move/update).",
      x: 0,
      y: 420,
    },
    {
      id: "listeners",
      label: "listeners (renderer.update(), UI panels, …)",
      description:
        "Any subscriber — the DOM renderer, UI panels, presence. A listener that throws does not stop the ones registered after it.",
      x: 0,
      y: 560,
      kind: "end",
    },
  ],
  edges: [
    { id: "mutation-storeSet", from: "mutation", to: "storeSet", order: 1 },
    { id: "storeSet-documentChange", from: "storeSet", to: "documentChange", order: 2 },
    { id: "documentChange-editorEvent", from: "documentChange", to: "editorEvent", order: 3 },
    { id: "editorEvent-listeners", from: "editorEvent", to: "listeners", order: 4 },
  ],
};
