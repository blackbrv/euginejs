import { nodeNotFound } from "./errors.js";
import {
  hasNode,
  insertNode,
  moveNode,
  removeNode,
  reorderChildren,
  replaceNode,
  restoreSubtree,
  unwrapNode,
  updateNodeProps,
  updateNodeStyles,
  wrapNode,
  type CreateNodeOptions,
} from "./tree.js";
import type { EugineDocument, EugineNode, NodeProps, NodeStyles } from "./types.js";

/**
 * The serializable form of a document mutation — plain JSON data, no class
 * instances, no captured closures.
 *
 * This is the missing half of the PRD's collaboration pipeline (§47):
 *
 *   User Action → Command → Operation Serialization → Transport
 *               → Remote Client → Apply Operation
 *
 * A `Command` can execute and undo, but it cannot cross a network: it is an
 * object with private fields and methods. Without an operation format, the
 * only thing a developer can put on the wire is the whole document — which is
 * exactly what the PRD warns against, and exactly how a collaborative session
 * ends up last-write-wins.
 *
 * Note that `insert`, `attach` and `wrap` carry the ids they created rather
 * than letting the receiving client mint its own. Every client must agree on
 * node identity, so ids travel with the operation.
 */
export type EugineOperation =
  | { type: "insert"; node: EugineNode; parentId: string; index?: number }
  | { type: "attach"; nodes: Record<string, EugineNode>; rootId: string; parentId: string; index?: number }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; parentId: string; index?: number }
  | { type: "setProps"; id: string; patch: NodeProps; merge: boolean; unset?: string[] }
  | { type: "setStyles"; id: string; patch: NodeStyles; merge: boolean; unset?: string[] }
  | { type: "replace"; id: string; node: EugineNode }
  | { type: "reorder"; parentId: string; order: string[] }
  | { type: "wrap"; id: string; wrapperId: string; wrapperType: string; wrapper?: CreateNodeOptions }
  | { type: "unwrap"; id: string };

export type EugineOperationType = EugineOperation["type"];

/**
 * What to do with an operation whose target node no longer exists.
 *
 * `"throw"` is right for local calls, where a missing node means a bug.
 * `"drop"` is right for anything arriving from another client, where a
 * missing node is *expected* — B added a child to a container A deleted a
 * moment earlier. Throwing there kills the sync loop and everything queued
 * behind it over one late packet.
 */
export type OperationConflictPolicy = "drop" | "throw";

export interface ApplyOperationOptions {
  policy?: OperationConflictPolicy;
}

export interface ApplyOperationsResult {
  document: EugineDocument;
  /** Operations that were applied, in order. */
  applied: EugineOperation[];
  /** Operations skipped because their target no longer exists. */
  dropped: EugineOperation[];
}

/** Every node id an operation needs to already exist for it to make sense. */
function requiredIds(operation: EugineOperation): string[] {
  switch (operation.type) {
    case "insert":
    case "attach":
      return [operation.parentId];
    case "remove":
    case "unwrap":
    case "replace":
    case "setProps":
    case "setStyles":
      return [operation.id];
    case "move":
      return [operation.id, operation.parentId];
    case "reorder":
      return [operation.parentId];
    case "wrap":
      return [operation.id];
  }
}

/**
 * True when the operation's effect is already present, so applying it again
 * would be wrong (a duplicate insert) rather than merely redundant. Transports
 * redeliver; an operation that cannot be applied twice safely is a liability.
 */
function isAlreadyApplied(document: EugineDocument, operation: EugineOperation): boolean {
  switch (operation.type) {
    case "insert":
      return hasNode(document, operation.node.id);
    case "attach":
      return hasNode(document, operation.rootId);
    case "wrap":
      return hasNode(document, operation.wrapperId);
    default:
      return false;
  }
}

/**
 * Applies one operation to a document, returning the new document — or `null`
 * if it was dropped because its target is gone (and the policy allows that).
 * Pure: never mutates the input.
 */
export function applyOperation(
  document: EugineDocument,
  operation: EugineOperation,
  options: ApplyOperationOptions = {},
): EugineDocument | null {
  const policy = options.policy ?? "throw";

  for (const id of requiredIds(operation)) {
    if (hasNode(document, id)) continue;
    if (policy === "drop") return null;
    throw nodeNotFound(id);
  }

  if (isAlreadyApplied(document, operation)) {
    if (policy === "drop") return null;
    throw nodeNotFound(operation.type === "insert" ? operation.node.id : "duplicate target");
  }

  switch (operation.type) {
    case "insert":
      return insertNode(document, operation.node, operation.parentId, operation.index);
    case "attach":
      return restoreSubtree(document, operation.nodes, operation.rootId, operation.parentId, {
        index: operation.index,
        overwriteExisting: false,
      });
    case "remove":
      return removeNode(document, operation.id);
    case "move":
      return moveNode(document, operation.id, operation.parentId, { index: operation.index });
    case "setProps":
      return updateNodeProps(document, operation.id, operation.patch, {
        merge: operation.merge,
        unset: operation.unset,
      });
    case "setStyles":
      return updateNodeStyles(document, operation.id, operation.patch, {
        merge: operation.merge,
        unset: operation.unset,
      });
    case "replace":
      return replaceNode(document, operation.id, operation.node);
    case "reorder":
      // Never strict: a remote reorder was computed against a child set that
      // may since have gained or lost a sibling, and refusing it outright
      // would be worse than placing it as closely as we can.
      return reorderChildren(document, operation.parentId, operation.order, { strict: false });
    case "wrap":
      return wrapNode(document, operation.id, operation.wrapperType, { ...operation.wrapper, id: operation.wrapperId })
        .document;
    case "unwrap":
      return unwrapNode(document, operation.id);
  }
}

/**
 * Applies a batch of operations in order, carrying the document forward
 * through each. With the default `"drop"` policy an operation whose target has
 * vanished is skipped and reported rather than aborting the batch.
 */
export function applyOperations(
  document: EugineDocument,
  operations: readonly EugineOperation[],
  options: ApplyOperationOptions = {},
): ApplyOperationsResult {
  const policy = options.policy ?? "drop";
  let current = document;
  const applied: EugineOperation[] = [];
  const dropped: EugineOperation[] = [];

  for (const operation of operations) {
    const next = applyOperation(current, operation, { policy });
    if (next === null) {
      dropped.push(operation);
      continue;
    }
    current = next;
    applied.push(operation);
  }

  return { document: current, applied, dropped };
}

/** Runtime guard for operations arriving from an untrusted transport. */
export function isEugineOperation(value: unknown): value is EugineOperation {
  if (typeof value !== "object" || value === null) return false;
  const op = value as { type?: unknown };
  switch (op.type) {
    case "insert":
    case "attach":
    case "remove":
    case "move":
    case "setProps":
    case "setStyles":
    case "replace":
    case "reorder":
    case "wrap":
    case "unwrap":
      return true;
    default:
      return false;
  }
}
