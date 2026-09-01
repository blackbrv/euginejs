import type { DiagramDefinition } from "./types";

export type NodeId =
  | "command"
  | "replay"
  | "undoStack"
  | "redoStack"
  | "onCommit"
  | "throwPoint"
  | "rollback"
  | "error";

export const historyTransactionsDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "command",
      label: "Command.execute()",
      description:
        "The mutating command runs inside a transaction, so each multi-step editor action is one undo step.",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "undoStack",
      label: "push transaction onto undo stack",
      description: "The executed transaction is appended to the undo stack (oldest first).",
      x: 0,
      y: 140,
    },
    {
      id: "redoStack",
      label: "clear redo stack",
      description: "Executing a new command makes the redo stack stale, so it is emptied.",
      x: 330,
      y: 140,
    },
    {
      id: "onCommit",
      label: "onCommit(operations)",
      description:
        "Emits the committed transaction's serializable operations so collaboration can ship them to other clients.",
      x: 0,
      y: 280,
      kind: "end",
    },
    {
      id: "replay",
      label: "replay inverse commands against the current document",
      description:
        "Undo derives each command's inverse against the document as it is at undo time, touching only what that command touched.",
      x: 0,
      y: 440,
      kind: "fork",
    },
    {
      id: "throwPoint",
      label: "a command throws",
      description:
        "One inverse fails — e.g. the target was removed by another client. This must not be an error loop: it is handled.",
      x: -360,
      y: 620,
      kind: "error",
    },
    {
      id: "rollback",
      label: "document rolled back to its pre-replay state; transaction stays on the undo stack",
      description:
        "The transaction is popped only after the replay succeeds. Pop-then-replay would leave the document half-reverted and drop the edit from both stacks forever.",
      x: -360,
      y: 760,
    },
    {
      id: "error",
      label: "EUGINE_HISTORY_ERROR (original error as cause)",
      description:
        "The failure is wrapped and rethrown, so the caller can react without ever losing the edit.",
      x: 0,
      y: 620,
      kind: "end",
    },
  ],
  edges: [
    { id: "command-undoStack", from: "command", to: "undoStack" },
    { id: "command-redoStack", from: "command", to: "redoStack" },
    { id: "undoStack-onCommit", from: "undoStack", to: "onCommit" },
    { id: "redoStack-onCommit", from: "redoStack", to: "onCommit" },
    { id: "undoStack-replay", from: "undoStack", to: "replay" },
    { id: "replay-throwPoint", from: "replay", to: "throwPoint" },
    { id: "throwPoint-rollback", from: "throwPoint", to: "rollback" },
    { id: "throwPoint-error", from: "throwPoint", to: "error" },
  ],
  routes: [
    {
      id: "execute",
      label: "Execute",
      nodeIds: ["command", "undoStack", "redoStack", "onCommit"],
      edgeIds: ["command-undoStack", "command-redoStack", "undoStack-onCommit", "redoStack-onCommit"],
    },
    {
      id: "undo-success",
      label: "Undo — success",
      nodeIds: ["undoStack", "replay"],
      edgeIds: ["undoStack-replay", "replay-throwPoint"],
    },
    {
      id: "undo-rollback",
      label: "Undo — rollback on throw",
      nodeIds: ["throwPoint", "rollback", "error"],
      edgeIds: ["throwPoint-rollback", "throwPoint-error"],
    },
  ],
};
