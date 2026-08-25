import { invalidDocument, nodeNotFound } from "./errors.js";
import { createId } from "./id.js";
import { CURRENT_SCHEMA_VERSION, type EugineDocument, type EugineNode, type NodeProps, type NodeStyles } from "./types.js";

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

export function createNode(type: string, options: CreateNodeOptions = {}): EugineNode {
  return {
    id: options.id ?? createId("node"),
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

/**
 * Re-attaches a previously captured subtree (see captureSubtree) back into
 * the document under `parentId` at `index`. Used to undo node removal.
 */
export function restoreSubtree(
  document: EugineDocument,
  snapshot: Record<string, EugineNode>,
  rootId: string,
  parentId: string,
  index?: number,
): EugineDocument {
  const nodes = { ...document.nodes, ...snapshot };
  const parent = nodes[parentId];
  if (!parent) throw nodeNotFound(parentId);

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

export function reorderChildren(document: EugineDocument, parentId: string, orderedChildIds: string[]): EugineDocument {
  const parent = getNode(document, parentId);
  const currentSet = new Set(parent.children);
  const nextSet = new Set(orderedChildIds);
  if (currentSet.size !== nextSet.size || [...currentSet].some((id) => !nextSet.has(id))) {
    throw invalidDocument("reorderChildren must be given exactly the current child ids, reordered.", {
      parentId,
    });
  }
  const nodes = cloneNodesMap(document);
  nodes[parentId] = { ...parent, children: orderedChildIds.slice() };
  return { ...document, nodes };
}

export function updateNodeProps(document: EugineDocument, id: string, props: NodeProps, options: { merge?: boolean } = { merge: true }): EugineDocument {
  const node = getNode(document, id);
  const nodes = cloneNodesMap(document);
  nodes[id] = { ...node, props: options.merge === false ? props : { ...node.props, ...props } };
  return { ...document, nodes };
}

export function updateNodeStyles(document: EugineDocument, id: string, styles: NodeStyles, options: { merge?: boolean } = { merge: true }): EugineDocument {
  const node = getNode(document, id);
  const nodes = cloneNodesMap(document);
  nodes[id] = { ...node, styles: options.merge === false ? styles : { ...node.styles, ...styles } };
  return { ...document, nodes };
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
export function duplicateSubtree(document: EugineDocument, id: string): { document: EugineDocument; newId: string } {
  const source = getNode(document, id);
  const idMap = new Map<string, string>();
  for (const originalId of subtreeIds(document, id)) {
    idMap.set(originalId, createId("node"));
  }

  const nodes = cloneNodesMap(document);
  for (const originalId of idMap.keys()) {
    const originalNode = getNode(document, originalId);
    const newId = idMap.get(originalId)!;
    nodes[newId] = {
      ...originalNode,
      id: newId,
      parent: originalNode.parent ? idMap.get(originalNode.parent) ?? originalNode.parent : null,
      children: originalNode.children.map((childId) => idMap.get(childId) ?? childId),
    };
  }

  const newId = idMap.get(source.id)!;
  nodes[newId] = { ...nodes[newId]!, parent: null };

  return { document: { ...document, nodes }, newId };
}

/** Wraps `id` in a newly created node of `wrapperType`, preserving position. */
export function wrapNode(document: EugineDocument, id: string, wrapperType: string, wrapperOptions: CreateNodeOptions = {}): { document: EugineDocument; wrapperId: string } {
  const node = getNode(document, id);
  const parentId = node.parent;
  if (!parentId) throw invalidDocument("Cannot wrap the root node.", { id });
  const parent = getNode(document, parentId);
  const index = parent.children.indexOf(id);

  const wrapper = createNode(wrapperType, wrapperOptions);
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
