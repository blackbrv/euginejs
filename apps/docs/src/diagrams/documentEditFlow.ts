import type { DiagramDefinition } from "./types";

type NodeId =
  | "call"
  | "validate"
  | "command"
  | "history"
  | "store"
  | "storeEvent"
  | "editorEvent"
  | "renderer"
  | "domPatch"
  | "html";

export const documentEditFlowDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "call",
      label: "editor.insert() / update() / remove()",
      description:
        "The public editor facade call that starts a mutation. drop rules are validated before any command is built.",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "validate",
      label: "ComponentRegistry validates drop rules",
      description:
        "Editor validates the operation against the ComponentRegistry before constructing a command, so invalid inserts fail early.",
      x: 0,
      y: 120,
    },
    {
      id: "command",
      label: "Command constructed",
      description:
        "A Command object with execute(store) and undo(store), e.g. InsertNodeCommand, UpdatePropsCommand, RemoveNodeCommand.",
      x: 0,
      y: 240,
    },
    {
      id: "history",
      label: "history.execute()",
      description:
        "Wraps the command in a transaction so a multi-step editor action becomes exactly one undo step.",
      x: 0,
      y: 360,
    },
    {
      id: "store",
      label: "DocumentStore.set()",
      description:
        "Shallow-copies the nodes map and replaces only the entries it touched; every untouched node keeps the same object reference.",
      x: 0,
      y: 480,
      kind: "fork",
    },
    {
      id: "storeEvent",
      label: "document.change event (synchronous)",
      description:
        "Fired synchronously inside history.execute(), before the editor-level event. Selection is pruned before this fires.",
      x: -280,
      y: 600,
    },
    {
      id: "editorEvent",
      label: "Editor-level event (node.create / node.delete / node.move)",
      description:
        "Emitted after the store event, e.g. node.create with the new node's details.",
      x: 280,
      y: 600,
    },
    {
      id: "renderer",
      label: "Renderer reconciles by reference-equality",
      description:
        "The DOM renderer reuses a node's cached element when previous === node, so only touched nodes rebuild incrementally.",
      x: 0,
      y: 720,
      kind: "fork",
    },
    {
      id: "domPatch",
      label: "DOM patch (browser)",
      description:
        "Incremental patch to the live DOM in the editor. Untouched nodes keep scroll position, focus, and caret.",
      x: -180,
      y: 830,
      kind: "end",
    },
    {
      id: "html",
      label: "HTML string (server)",
      description:
        "Deterministic HTML string output via renderToString(), safe to render on a server with no window.",
      x: 180,
      y: 830,
      kind: "end",
    },
  ],
  edges: [
    { id: "call-validate", from: "call", to: "validate" },
    { id: "validate-command", from: "validate", to: "command" },
    { id: "command-history", from: "command", to: "history" },
    { id: "history-store", from: "history", to: "store" },
    { id: "store-storeEvent", from: "store", to: "storeEvent", order: 1 },
    { id: "store-editorEvent", from: "store", to: "editorEvent", order: 2 },
    { id: "storeEvent-renderer", from: "storeEvent", to: "renderer" },
    { id: "editorEvent-renderer", from: "editorEvent", to: "renderer" },
    { id: "renderer-domPatch", from: "renderer", to: "domPatch" },
    { id: "renderer-html", from: "renderer", to: "html" },
  ],
};
