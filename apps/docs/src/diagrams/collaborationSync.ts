import type { DiagramDefinition } from "./types";

export type NodeId =
  | "aLocalEdit"
  | "aCommand"
  | "aHistory"
  | "onCommit"
  | "transport"
  | "bApplyRemote"
  | "bypass"
  | "bStore"
  | "bRenderer"
  | "bDropped";

export const collaborationSyncDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "aLocalEdit",
      label: "Editor A: local edit",
      description:
        "Author A mutates the document through the normal editor facade (the `client` region).",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "aCommand",
      label: "Command",
      description:
        "A mutating command is constructed and validated, mirroring the local edit pipeline.",
      x: 0,
      y: 150,
    },
    {
      id: "aHistory",
      label: "History.execute() (transaction)",
      description:
        "Runs the command inside a transaction so a multi-step action is one undo step on A's stack.",
      x: 0,
      y: 300,
    },
    {
      id: "onCommit",
      label: "onCommit(operation JSON)",
      description:
        "The committed transaction serializes to plain JSON operations (the `outbound` region) — never the whole document.",
      x: 0,
      y: 450,
      kind: "fork",
    },
    {
      id: "transport",
      label: "[transport]",
      description:
        "The host's own transport — WebSocket, WebRTC, or polling. Eugine ships no transport.",
      x: 0,
      y: 600,
    },
    {
      id: "bApplyRemote",
      label: "Editor B: applyRemote(operation)",
      description:
        "B receives the operation and applies it via applyRemote() (the `inbound` region).",
      x: 0,
      y: 750,
      kind: "fork",
    },
    {
      id: "bypass",
      label: "bypasses history / undo stack",
      description:
        "A remote edit never lands on the local undo stack — otherwise B's next Ctrl+Z would revert A's work.",
      x: -320,
      y: 900,
    },
    {
      id: "bStore",
      label: "DocumentStore.set()",
      description:
        "Writes the new document, emitting document.change so B's renderer and listeners update.",
      x: -320,
      y: 1050,
    },
    {
      id: "bRenderer",
      label: "renderer updates",
      description:
        "B's DOM renderer reconciles by reference equality, repainting only the affected nodes.",
      x: 0,
      y: 1050,
      kind: "end",
    },
    {
      id: "bDropped",
      label: "dropped (target already deleted)",
      description:
        "If the operation targets a node B already deleted, it is dropped rather than thrown — an ordinary race, not an error that takes the sync loop down.",
      x: 320,
      y: 900,
      kind: "end",
    },
  ],
  edges: [
    { id: "aLocalEdit-aCommand", from: "aLocalEdit", to: "aCommand" },
    { id: "aCommand-aHistory", from: "aCommand", to: "aHistory" },
    { id: "aHistory-onCommit", from: "aHistory", to: "onCommit" },
    { id: "onCommit-transport", from: "onCommit", to: "transport" },
    { id: "transport-bApplyRemote", from: "transport", to: "bApplyRemote" },
    { id: "bApplyRemote-bypass", from: "bApplyRemote", to: "bypass" },
    { id: "bypass-bStore", from: "bypass", to: "bStore" },
    { id: "bStore-bRenderer", from: "bStore", to: "bRenderer" },
    { id: "bApplyRemote-bDropped", from: "bApplyRemote", to: "bDropped" },
  ],
  routes: [
    {
      id: "normal",
      label: "Normal sync",
      nodeIds: [
        "aLocalEdit",
        "aCommand",
        "aHistory",
        "onCommit",
        "transport",
        "bApplyRemote",
        "bypass",
        "bStore",
        "bRenderer",
      ],
      edgeIds: [
        "aLocalEdit-aCommand",
        "aCommand-aHistory",
        "aHistory-onCommit",
        "onCommit-transport",
        "transport-bApplyRemote",
        "bApplyRemote-bypass",
        "bypass-bStore",
        "bStore-bRenderer",
      ],
    },
    {
      id: "race",
      label: "Target already deleted (race)",
      nodeIds: ["bApplyRemote", "bDropped"],
      edgeIds: ["bApplyRemote-bDropped"],
    },
  ],
};
