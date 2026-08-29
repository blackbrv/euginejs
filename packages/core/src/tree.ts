import { invalidDocument, nodeNotFound } from "./errors.js";
import { createId } from "./id.js";
import { CURRENT_SCHEMA_VERSION, type EugineDocument, type EugineNode, type NodeProps, type NodeStyles } from "./types.js";

/** A self-contained, detached copy of a node subtree — see captureSubtree()/cloneSubtreeSnapshot(). */
export interface SubtreeSnapshot {
  rootId: string;
  nodes: Record<string, EugineNode>;
}

export interface CreateNodeOptions {
  id?: string;
  props?: NodeProps;
  styles?: NodeStyles;
  className?: string;
  children?: string[];
  metadata?: Record<string, unknown>;
  customData?: Record<string, unknown>;
  locked?: boolean;
  editable?: boolean;
  hidden?: boolean;
}

/**
 * Mints new node ids. Every id-generating tree function takes one so a
 * collaborative host can hand out client-scoped ids (`"c3_17"`, `"c9_17"`)
 * rather than relying on two browsers' independent `Math.random()` never
 * colliding — `insertNode()` throws on a duplicate id, so a collision is a
 * hard failure in the sync loop, not a cosmetic problem.
 */
export type IdFactory = () => string;

const defaultIdFactory: IdFactory = () => createId("node");

export function createNode(type: string, options: CreateNodeOptions = {}, idFactory: IdFactory = defaultIdFactory): EugineNode {
  return {
    id: options.id ?? idFactory(),
    type,
    props: options.props ?? {},
    styles: options.styles,
    className: options.className,
    children: options.children ?? [],
    parent: null,
    metadata: options.metadata,
    customData: options.customData,
    locked: options.locked,
    editable: options.editable,
    hidden: options.hidden,
  };
}

export function createEmptyDocument(rootType = "root"): EugineDocument {
  const root = createNode(rootType, { id: "root" });
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootId: root.id,
    nodes: { [root.id]: root },
    revision: 0,
  };
}

export function getNode(document: EugineDocument, id: string): EugineNode {
  const node = document.nodes[id];
  if (!node) throw nodeNotFound(id);
  return node;
}

export function hasNode(document: EugineDocument, id: string): boolean {
  return Boolean(document.nodes[id]);
}

export function getRoot(document: EugineDocument): EugineNode {
  return getNode(document, document.rootId);
}

export function getChildren(document: EugineDocument, id: string): EugineNode[] {
  return getNode(document, id).children.map((childId) => getNode(document, childId));
}

export function getParent(document: EugineDocument, id: string): EugineNode | null {
  const node = getNode(document, id);
  return node.parent ? getNode(document, node.parent) : null;
}

export function getAncestors(document: EugineDocument, id: string): EugineNode[] {
  const ancestors: EugineNode[] = [];
  let current = getParent(document, id);
  while (current) {
    ancestors.push(current);
    current = getParent(document, current.id);
  }
  return ancestors;
}

/** True if `maybeAncestorId` is `id` itself or one of its ancestors. */
export function isAncestor(document: EugineDocument, maybeAncestorId: string, id: string): boolean {
  if (maybeAncestorId === id) return true;
  return getAncestors(document, id).some((n) => n.id === maybeAncestorId);
}

export function walk(document: EugineDocument, visit: (node: EugineNode, depth: number) => void, startId = document.rootId, depth = 0): void {
  const node = getNode(document, startId);
  visit(node, depth);
  for (const childId of node.children) {
    walk(document, visit, childId, depth + 1);
  }
}

/** Every node id, including the root, in the given subtree (pre-order). */
export function subtreeIds(document: EugineDocument, id: string): string[] {
  const ids: string[] = [];
  walk(document, (n) => ids.push(n.id), id);
  return ids;
}

function cloneNodesMap(document: EugineDocument): Record<string, EugineNode> {
  return { ...document.nodes };
}

/**
 * Inserts `node` (with its own children already present in `document.nodes`,
 * or a lone node) as a child of `parentId` at `index` (defaults to end).
 * Returns a new document; never mutates the input.
 */
export function insertNode(
  document: EugineDocument,
  node: EugineNode,
  parentId: string,
  index?: number,
): EugineDocument {
  const parent = getNode(document, parentId);
  if (document.nodes[node.id] && document.nodes[node.id] !== node) {
    throw invalidDocument(`Node id "${node.id}" already exists in the document.`, { id: node.id });
  }

  const nodes = cloneNodesMap(document);
  nodes[node.id] = { ...node, parent: parentId };

  const children = parent.children.slice();
  const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
  children.splice(at, 0, node.id);
  nodes[parentId] = { ...parent, children };

  return { ...document, nodes };
}

/** Captures a subtree's nodes by id, for later restoration (e.g. undoing a removal). */
export function captureSubtree(document: EugineDocument, id: string): Record<string, EugineNode> {
  const snapshot: Record<string, EugineNode> = {};
  for (const nodeId of subtreeIds(document, id)) {
    snapshot[nodeId] = getNode(document, nodeId);
  }
  return snapshot;
}

export interface RestoreSubtreeOptions {
  index?: number;
  /**
   * Whether a snapshot node replaces a node with the same id that is already
   * live in the document. Defaults to true (the plain "paste this subtree in"
   * behaviour).
   *
   * Undo passes false. A captured snapshot is a photograph of the past, and
   * spreading it wholesale over the current nodes map is how an undo silently
   * reverts edits that happened *after* the snapshot was taken — someone
   * else's edits, in a collaborative session. With false, restore fills in
   * only what is genuinely missing and leaves any live node alone.
   */
  overwriteExisting?: boolean;
}

/**
 * Re-attaches a previously captured subtree (see captureSubtree) back into
 * the document under `parentId` at `index`. Used to undo node removal.
 */
export function restoreSubtree(
  document: EugineDocument,
  snapshot: Record<string, EugineNode>,
  rootId: string,
  parentId: string,
  indexOrOptions?: number | RestoreSubtreeOptions,
): EugineDocument {
  const options: RestoreSubtreeOptions =
    typeof indexOrOptions === "number" || indexOrOptions === undefined ? { index: indexOrOptions } : indexOrOptions;
  const { index, overwriteExisting = true } = options;

  const nodes = { ...document.nodes };
  for (const [id, node] of Object.entries(snapshot)) {
    if (!overwriteExisting && nodes[id]) continue;
    nodes[id] = node;
  }

  const parent = nodes[parentId];
  if (!parent) throw nodeNotFound(parentId);

  // Restoring must be idempotent: the same operation can arrive twice over a
  // network, and an undo can race a remote re-creation of the same id. If the
  // subtree root is already attached anywhere, re-listing it as a child here
  // would give it two parents and fail validateDocument().
  const liveRoot = document.nodes[rootId];
  const alreadyAttached =
    parent.children.includes(rootId) ||
    (liveRoot?.parent != null && Boolean(nodes[liveRoot.parent]?.children.includes(rootId)));
  if (alreadyAttached) return { ...document, nodes };

  const children = parent.children.slice();
  const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
  children.splice(at, 0, rootId);
  nodes[parentId] = { ...parent, children };
  nodes[rootId] = { ...nodes[rootId]!, parent: parentId };

  return { ...document, nodes };
}

/** Removes a node and its entire subtree from the document. */
export function removeNode(document: EugineDocument, id: string): EugineDocument {
  if (id === document.rootId) {
    throw invalidDocument("The root node cannot be removed.", { id });
  }
  const node = getNode(document, id);
  const parent = node.parent ? getNode(document, node.parent) : null;
  const idsToRemove = new Set(subtreeIds(document, id));

  const nodes = cloneNodesMap(document);
  for (const removedId of idsToRemove) delete nodes[removedId];

  if (parent) {
    nodes[parent.id] = { ...parent, children: parent.children.filter((childId) => childId !== id) };
  }

  return { ...document, nodes };
}

export interface MoveOptions {
  index?: number;
}

/** Moves an existing node (and its subtree) to a new parent at an optional index. */
export function moveNode(document: EugineDocument, id: string, newParentId: string, options: MoveOptions = {}): EugineDocument {
  if (id === document.rootId) {
    throw invalidDocument("The root node cannot be moved.", { id });
  }
  const node = getNode(document, id);
  const newParent = getNode(document, newParentId);

  if (isAncestor(document, id, newParentId)) {
    throw invalidDocument("Cannot move a node inside its own subtree.", { id, newParentId });
  }

  const nodes = cloneNodesMap(document);

  const oldParent = node.parent ? nodes[node.parent] : undefined;
  if (oldParent) {
    nodes[oldParent.id] = { ...oldParent, children: oldParent.children.filter((childId) => childId !== id) };
  }

  const targetParent = oldParent && oldParent.id === newParentId ? nodes[newParentId]! : newParent;
  const children = targetParent.children.slice();
  const at = options.index === undefined ? children.length : Math.max(0, Math.min(options.index, children.length));
  children.splice(at, 0, id);
  nodes[newParentId] = { ...targetParent, children };
  nodes[id] = { ...node, parent: newParentId };

  return { ...document, nodes };
}

/**
 * Projects a desired child order onto whatever children a parent actually has
 * right now: ids that no longer exist are dropped, and children that appeared
 * since (a sibling another user just inserted) are kept, appended in their
 * current relative order.
 *
 * This is what makes a reorder safely undoable. The strict form below throws
 * when the child set has changed, which is right for a direct API call — a
 * stale order there is a bug worth surfacing — but fatal during undo, where
 * the set having changed is expected and throwing strands the document
 * half-reverted.
 */
export function reconcileOrder(currentChildIds: string[], desiredOrder: string[]): string[] {
  const current = new Set(currentChildIds);
  const kept = desiredOrder.filter((id) => current.has(id));
  const placed = new Set(kept);
  const appended = currentChildIds.filter((id) => !placed.has(id));
  return [...kept, ...appended];
}

export interface ReorderOptions {
  /**
   * When true (the default), `orderedChildIds` must be exactly the parent's
   * current children, reordered, or the call throws. When false, the order is
   * reconciled against the live child set instead — see reconcileOrder().
   */
  strict?: boolean;
}

export function reorderChildren(
  document: EugineDocument,
  parentId: string,
  orderedChildIds: string[],
  options: ReorderOptions = {},
): EugineDocument {
  const parent = getNode(document, parentId);
  const currentSet = new Set(parent.children);
  const nextSet = new Set(orderedChildIds);
  const matches = currentSet.size === nextSet.size && ![...currentSet].some((id) => !nextSet.has(id));

  if (!matches && options.strict !== false) {
    throw invalidDocument("reorderChildren must be given exactly the current child ids, reordered.", {
      parentId,
    });
  }

  const children = matches ? orderedChildIds.slice() : reconcileOrder(parent.children, orderedChildIds);
  const nodes = cloneNodesMap(document);
  nodes[parentId] = { ...parent, children };
  return { ...document, nodes };
}

export interface UpdateNodeDataOptions {
  merge?: boolean;
  /**
   * Keys to delete outright, applied after the merge. This is what lets an
   * undo be expressed as a *patch* — "restore these keys, remove those" —
   * instead of a wholesale replacement of the props object. A wholesale
   * replacement also wipes every key added since the value was captured,
   * which in a collaborative session means silently deleting another user's
   * work as a side effect of your own undo.
   */
  unset?: readonly string[];
}

function applyPatch<T extends Record<string, unknown>>(
  existing: T | undefined,
  patch: T,
  options: UpdateNodeDataOptions,
): T {
  const next: Record<string, unknown> = options.merge === false ? { ...patch } : { ...existing, ...patch };
  for (const key of options.unset ?? []) delete next[key];
  return next as T;
}

export function updateNodeProps(
  document: EugineDocument,
  id: string,
  props: NodeProps,
  options: UpdateNodeDataOptions = { merge: true },
): EugineDocument {
  const node = getNode(document, id);
  const nodes = cloneNodesMap(document);
  nodes[id] = { ...node, props: applyPatch(node.props, props, options) };
  return { ...document, nodes };
}

export function updateNodeStyles(
  document: EugineDocument,
  id: string,
  styles: NodeStyles,
  options: UpdateNodeDataOptions = { merge: true },
): EugineDocument {
  const node = getNode(document, id);
  const nodes = cloneNodesMap(document);
  nodes[id] = { ...node, styles: applyPatch(node.styles, styles, options) };
  return { ...document, nodes };
}

/**
 * The patch that reverses applying `patch` to `before` — restoring only the
 * keys this change actually touched, and unsetting the ones it introduced.
 * Keys nobody touched are left out entirely, so replaying this inverse never
 * disturbs a concurrent edit to a different key on the same node.
 */
export function invertPatch(
  before: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
  merge: boolean,
): { patch: Record<string, unknown>; unset: string[] } {
  const previous = before ?? {};
  // A non-merging write replaces the whole object, so it touches every key it
  // removed as well as every key it set.
  const touched = merge ? Object.keys(patch) : [...new Set([...Object.keys(patch), ...Object.keys(previous)])];

  const restore: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const key of touched) {
    if (Object.prototype.hasOwnProperty.call(previous, key)) restore[key] = previous[key];
    else unset.push(key);
  }
  return { patch: restore, unset };
}

export function replaceNode(document: EugineDocument, id: string, next: EugineNode): EugineDocument {
  const existing = getNode(document, id);
  const nodes = cloneNodesMap(document);
  nodes[id] = { ...next, id, parent: existing.parent, children: next.children ?? existing.children };
  return { ...document, nodes };
}

/**
 * Deep-clones a subtree, regenerating every id, and returns the new root
 * node id plus the updated document (the clone is NOT yet attached to a
 * parent — insert it explicitly).
 */
/**
 * Fresh-id clone of a set of nodes (by id, all drawn from `sourceNodes`):
 * every id gets a new one, and every `parent`/`children` pointer among them
 * is remapped to match. Shared by duplicateSubtree() (cloning within a live
 * document) and cloneSubtreeSnapshot() (cloning an external, captured
 * snapshot — see that function's docs).
 */
function remapSubtreeIds(
  sourceNodes: Record<string, EugineNode>,
  ids: string[],
  idFactory: IdFactory = defaultIdFactory,
): { idMap: Map<string, string>; nodes: Record<string, EugineNode> } {
  const idMap = new Map<string, string>();
  for (const id of ids) idMap.set(id, idFactory());

  const nodes: Record<string, EugineNode> = {};
  for (const id of ids) {
    const original = sourceNodes[id]!;
    const newId = idMap.get(id)!;
    nodes[newId] = {
      ...original,
      id: newId,
      parent: original.parent ? (idMap.get(original.parent) ?? original.parent) : null,
      children: original.children.map((childId) => idMap.get(childId) ?? childId),
    };
  }
  return { idMap, nodes };
}

export function duplicateSubtree(
  document: EugineDocument,
  id: string,
  idFactory?: IdFactory,
): { document: EugineDocument; newId: string } {
  const { idMap, nodes: cloned } = remapSubtreeIds(document.nodes, subtreeIds(document, id), idFactory);
  const newId = idMap.get(id)!;
  cloned[newId] = { ...cloned[newId]!, parent: null };

  return { document: { ...document, nodes: { ...cloneNodesMap(document), ...cloned } }, newId };
}

/**
 * Clones an arbitrary captured subtree snapshot (see captureSubtree) with
 * fresh ids — independent of any live document, so the result can be
 * attached into ANY document/parent, any number of times, even after the
 * original node has been edited or removed. This is the "paste" half of a
 * copy/paste feature; captureSubtree() is the "copy" half:
 *
 *   const snapshot = captureSubtree(document, copiedId);   // copy
 *   const clone = cloneSubtreeSnapshot(snapshot, copiedId); // fresh ids
 *   const next = restoreSubtree(document, clone.nodes, clone.rootId, targetParentId); // paste
 *
 * (`editor.copySubtree()`/`editor.pasteSubtree()` wrap exactly this.)
 */
export function cloneSubtreeSnapshot(
  snapshot: Record<string, EugineNode>,
  rootId: string,
  idFactory?: IdFactory,
): { rootId: string; nodes: Record<string, EugineNode> } {
  const { idMap, nodes: cloned } = remapSubtreeIds(snapshot, Object.keys(snapshot), idFactory);
  const newRootId = idMap.get(rootId)!;
  cloned[newRootId] = { ...cloned[newRootId]!, parent: null };
  return { rootId: newRootId, nodes: cloned };
}

/** Wraps `id` in a newly created node of `wrapperType`, preserving position. */
export function wrapNode(
  document: EugineDocument,
  id: string,
  wrapperType: string,
  wrapperOptions: CreateNodeOptions = {},
  idFactory?: IdFactory,
): { document: EugineDocument; wrapperId: string } {
  const node = getNode(document, id);
  const parentId = node.parent;
  if (!parentId) throw invalidDocument("Cannot wrap the root node.", { id });
  const parent = getNode(document, parentId);
  const index = parent.children.indexOf(id);

  const wrapper = createNode(wrapperType, wrapperOptions, idFactory);
  let doc = insertNode(document, wrapper, parentId, index);
  doc = moveNode(doc, id, wrapper.id, { index: 0 });
  return { document: doc, wrapperId: wrapper.id };
}

/** Removes `id`, re-parenting its children into `id`'s former position under its parent. */
export function unwrapNode(document: EugineDocument, id: string): EugineDocument {
  const node = getNode(document, id);
  const parentId = node.parent;
  if (!parentId) throw invalidDocument("Cannot unwrap the root node.", { id });
  const parent = getNode(document, parentId);
  const baseIndex = parent.children.indexOf(id);

  let doc = document;
  const childIds = node.children.slice();
  childIds.forEach((childId, offset) => {
    doc = moveNode(doc, childId, parentId, { index: baseIndex + offset });
  });
  doc = removeNode(doc, id);
  return doc;
}

/** Structural + referential integrity checks described in the PRD's "Critical Invariants". */
export function validateDocument(document: EugineDocument): void {
  if (!document.nodes[document.rootId]) {
    throw invalidDocument(`Document root "${document.rootId}" does not exist in nodes map.`);
  }
  const seenAsChild = new Map<string, string>();
  for (const [id, node] of Object.entries(document.nodes)) {
    if (node.id !== id) {
      throw invalidDocument(`Node stored under key "${id}" has mismatched id "${node.id}".`);
    }
    for (const childId of node.children) {
      const child = document.nodes[childId];
      if (!child) {
        throw invalidDocument(`Node "${id}" references missing child "${childId}".`);
      }
      if (child.parent !== id) {
        throw invalidDocument(`Node "${childId}" parent pointer does not match its declared parent "${id}".`);
      }
      const previousParent = seenAsChild.get(childId);
      if (previousParent && previousParent !== id) {
        throw invalidDocument(`Node "${childId}" is referenced as a child of multiple parents.`, {
          parents: [previousParent, id],
        });
      }
      seenAsChild.set(childId, id);
    }
  }
  if (document.nodes[document.rootId]!.parent !== null) {
    throw invalidDocument("The root node must not have a parent.");
  }
}
