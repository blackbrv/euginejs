import { ComponentRegistry, EugineError, getNode } from "@euginejs/core";
import type { EugineDocument, EugineNode, NodeProps } from "@euginejs/core";

export interface DomRenderContext<TData = unknown> {
  node: EugineNode;
  data: TData | undefined;
  /** Whether this node is currently selected — see RenderToDomOptions.selection / DomRenderer.setSelection(). */
  selected: boolean;
}

/**
 * A component's DOM renderer: given its (already-defaulted) props and its
 * already-built children nodes, return the DOM node for this component. The
 * renderer is responsible for appending `children` wherever they belong
 * inside the returned node.
 */
export type DomComponentRenderer<TData = unknown> = (
  props: NodeProps,
  children: Node[],
  context: DomRenderContext<TData>,
) => Node;

export type OnMissingComponent = "throw" | "omit" | "placeholder";

export interface RenderToDomOptions<TData = unknown> {
  registry: ComponentRegistry<DomComponentRenderer<TData>>;
  data?: TData;
  onMissingComponent?: OnMissingComponent;
  /** Node ids selected at initial render. Update afterwards via DomRenderer.setSelection(). */
  selection?: Iterable<string>;
}

/**
 * The attribute the renderer sets (present, no value) on the element of any
 * currently-selected node — see DomRenderer.setSelection(). Eugine deliberately
 * ships no default selection styling: hosts decide what "selected" looks like
 * entirely through their own CSS (or their component render functions, via
 * DomRenderContext.selected), by targeting this attribute how they like, e.g.:
 *
 * ```css
 * [data-eugine-selected] { outline: 2px solid #6366f1; }
 * [data-eugine-selected]::after { content: attr(data-eugine-type); }
 * ```
 */
export const SELECTED_ATTRIBUTE = "data-eugine-selected";

export interface DomRenderer {
  /** Applies a new document, patching only the DOM nodes whose data actually changed. */
  update(document: EugineDocument): void;
  /**
   * Marks exactly these node ids as selected: toggles `data-eugine-selected`
   * on their live elements (no rebuild, no reconcile — existing element
   * identity, scroll position, focus, etc. are all preserved) and updates
   * DomRenderContext.selected for any node rebuilt afterwards. Call this
   * from wherever you observe `editor.selection` changing, e.g.
   * `editor.selection.onSelectionChange(({ ids }) => renderer.setSelection(ids))`.
   */
  setSelection(ids: Iterable<string>): void;
  /** The node ids currently marked selected. */
  getSelection(): string[];
  /** The live DOM node currently rendered for a given node id, if any. */
  getElement(id: string): Node | undefined;
  /** Detaches everything this renderer created and stops tracking it. */
  destroy(): void;
}

/**
 * Renders an EugineDocument into `container`. Subsequent update() calls
 * patch only the nodes whose underlying data object actually changed
 * (tree.ts operations only ever replace the specific nodes they touch, so
 * reference equality is a cheap, reliable "did this node change?" check),
 * instead of tearing down and rebuilding the whole tree.
 */
export function renderToDom<TData = unknown>(
  document: EugineDocument,
  container: Element,
  options: RenderToDomOptions<TData>,
): DomRenderer {
  const elements = new Map<string, Node>();
  const previousNodes = new Map<string, EugineNode>();
  const onMissing = options.onMissingComponent ?? "placeholder";
  let selectedIds = new Set<string>(options.selection ?? []);

  function buildNode(node: EugineNode, children: Node[]): Node {
    if (node.hidden) return globalThis.document.createComment(`eugine:hidden ${node.id}`);

    const definition = options.registry.tryGet(node.type);
    if (!definition) {
      switch (onMissing) {
        case "throw":
          throw new EugineError("EUGINE_RENDER_FAILED", `No component registered for type "${node.type}".`, {
            context: { id: node.id, type: node.type },
          });
        case "omit":
          return globalThis.document.createComment(`eugine:omitted ${node.id}`);
        case "placeholder":
        default:
          return buildPlaceholder(node, children);
      }
    }

    if (typeof definition.render === "function") {
      return definition.render(node.props, children, { node, data: options.data, selected: selectedIds.has(node.id) });
    }

    return buildPlaceholder(node, children);
  }

  function buildPlaceholder(node: EugineNode, children: Node[]): Node {
    const el = globalThis.document.createElement("div");
    el.setAttribute("data-eugine-id", node.id);
    el.setAttribute("data-eugine-type", node.type);
    if (node.className) el.className = node.className;
    for (const child of children) el.appendChild(child);
    return el;
  }

  function reconcile(id: string, doc: EugineDocument, visited: Set<string>): Node {
    visited.add(id);
    const node = getNode(doc, id);
    const previous = previousNodes.get(id);
    const existing = elements.get(id);

    if (existing && previous === node) {
      // This node's own data is unchanged; still walk children in case a
      // descendant changed — the descendant patches itself into place via
      // replaceWith(), so `existing`'s subtree never needs to be rebuilt.
      for (const childId of node.children) reconcile(childId, doc, visited);
      return existing;
    }

    const children = node.children.map((childId) => reconcile(childId, doc, visited));
    const next = buildNode(node, children);
    if (next instanceof Element) next.toggleAttribute(SELECTED_ATTRIBUTE, selectedIds.has(id));
    elements.set(id, next);
    previousNodes.set(id, node);

    if (existing && existing.parentNode) {
      existing.parentNode.replaceChild(next, existing);
    }
    return next;
  }

  function applySelection(next: Set<string>): void {
    const affected = new Set([...selectedIds, ...next]);
    for (const id of affected) {
      const el = elements.get(id);
      if (el instanceof Element) el.toggleAttribute(SELECTED_ATTRIBUTE, next.has(id));
    }
    selectedIds = next;
  }

  function collectGarbage(visited: Set<string>): void {
    for (const id of Array.from(elements.keys())) {
      if (!visited.has(id)) {
        elements.delete(id);
        previousNodes.delete(id);
      }
    }
    if (selectedIds.size > 0) {
      for (const id of selectedIds) {
        if (!visited.has(id)) selectedIds.delete(id);
      }
    }
  }

  function update(nextDocument: EugineDocument): void {
    const visited = new Set<string>();
    const rootNode = reconcile(nextDocument.rootId, nextDocument, visited);
    if (rootNode.parentNode !== container) {
      container.replaceChildren(rootNode);
    }
    collectGarbage(visited);
  }

  update(document);

  return {
    update,
    setSelection: (ids) => applySelection(new Set(ids)),
    getSelection: () => Array.from(selectedIds),
    getElement: (id) => elements.get(id),
    destroy: () => {
      container.replaceChildren();
      elements.clear();
      previousNodes.clear();
      selectedIds.clear();
    },
  };
}
