import { getAncestors, getNode, getParent, ComponentRegistry, type Editor, type EugineNode } from "eugine";
import { getDropPosition, renderToDom, type DomComponentRenderer, type DomRenderer, type DropPosition } from "eugine/renderer";
import { COMPONENT_SCHEMAS } from "./schema.js";
import { applyNodeStyles } from "./styleFields.js";

const NEW_COMPONENT_MIME = "application/x-eugine-new-component";
const MOVE_NODE_MIME = "application/x-eugine-move-node";

/** Component types whose text content can be edited in place by double-clicking them on the canvas. */
const EDITABLE_TEXT_PROP: Record<string, string> = {
  heading: "content",
  text: "content",
};

/** Walks up from `hoveredId` to the nearest ancestor (inclusive) that accepts `childType`. */
export function resolveDropParent(editor: Editor, hoveredId: string, childType: string): string {
  const document = editor.getDocument();
  const chain = [getNode(document, hoveredId), ...getAncestors(document, hoveredId)];
  for (const candidate of chain) {
    if (editor.registry.canAcceptChild({ parentType: candidate.type, childType, currentChildCount: candidate.children.length })) {
      return candidate.id;
    }
  }
  return document.rootId;
}

function makeEditableText(el: HTMLElement, node: EugineNode, editor: Editor, propKey: string): void {
  const originalDraggable = el.draggable;

  const stopEditing = (commit: boolean) => {
    if (el.contentEditable !== "true") return;
    el.contentEditable = "false";
    el.draggable = originalDraggable;
    el.classList.remove("eb-editing");
    if (commit) {
      const text = el.textContent ?? "";
      if (text !== String(node.props[propKey] ?? "")) editor.updateProps(node.id, { [propKey]: text });
    } else {
      el.textContent = String(node.props[propKey] ?? "");
    }
  };

  el.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    el.contentEditable = "true";
    el.draggable = false;
    el.classList.add("eb-editing");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

  el.addEventListener("blur", () => stopEditing(true));
  el.addEventListener("keydown", (event) => {
    if (el.contentEditable !== "true") return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopEditing(false);
      el.blur();
    }
  });
}

function makeInteractive(
  el: HTMLElement,
  node: EugineNode,
  editor: Editor,
  onSelect: (id: string, additive: boolean) => void,
  onContextMenu: (id: string, clientX: number, clientY: number) => void,
): void {
  el.dataset.eugineId = node.id;
  el.dataset.eugineType = node.type;
  el.classList.add("eb-node");
  applyNodeStyles(el, node.styles);

  el.addEventListener("click", (event) => {
    event.stopPropagation();
    if (el.contentEditable === "true") return;
    onSelect(node.id, event.shiftKey);
  });

  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(node.id, event.clientX, event.clientY);
  });

  if (node.id !== editor.getDocument().rootId) {
    el.draggable = true;
    el.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      event.dataTransfer?.setData(MOVE_NODE_MIME, node.id);
      event.dataTransfer!.effectAllowed = "move";
    });
  }

  const editableProp = EDITABLE_TEXT_PROP[node.type];
  if (editableProp) makeEditableText(el, node, editor, editableProp);
}

function buildRegistry(
  editor: Editor,
  onSelect: (id: string, additive: boolean) => void,
  onContextMenu: (id: string, clientX: number, clientY: number) => void,
): ComponentRegistry<DomComponentRenderer> {
  const registry = new ComponentRegistry<DomComponentRenderer>();

  registry.register({
    type: "root",
    render: (_props, children, ctx) => {
      const el = document.createElement("div");
      el.className = "eb-canvas-root";
      children.forEach((c) => el.appendChild(c));
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "section",
    render: (props, children, ctx) => {
      const el = document.createElement("section");
      el.className = ["eb-section", String(props.className ?? "")].filter(Boolean).join(" ");
      if (children.length === 0) el.appendChild(placeholder("Drop a component into this section"));
      else children.forEach((c) => el.appendChild(c));
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "container",
    render: (props, children, ctx) => {
      const el = document.createElement("div");
      el.className = ["eb-container", String(props.className ?? "")].filter(Boolean).join(" ");
      if (children.length === 0) el.appendChild(placeholder("Drop a component into this container"));
      else children.forEach((c) => el.appendChild(c));
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "heading",
    render: (props, _children, ctx) => {
      const el = document.createElement("h2");
      el.className = "eb-heading";
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "text",
    render: (props, _children, ctx) => {
      const el = document.createElement("p");
      el.className = "eb-text";
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "button",
    render: (props, _children, ctx) => {
      const el = document.createElement("a");
      el.className = "eb-button";
      el.textContent = String(props.label ?? "");
      el.href = String(props.href ?? "#");
      el.addEventListener("click", (event) => event.preventDefault());
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  registry.register({
    type: "image",
    render: (props, _children, ctx) => {
      const el = document.createElement("img");
      el.className = "eb-image";
      el.src = String(props.src ?? "");
      el.alt = String(props.alt ?? "");
      makeInteractive(el, ctx.node, editor, onSelect, onContextMenu);
      return el;
    },
  });

  return registry;
}

function placeholder(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "eb-placeholder";
  el.textContent = text;
  return el;
}

export interface CanvasController {
  renderer: DomRenderer;
  refresh(): void;
  /** Removes the delegated drag-and-drop listeners this controller attached (including one on `document`). Call this before discarding the controller so a remount doesn't leave stale listeners referencing a torn-down editor. */
  destroy(): void;
}

interface HoverTarget {
  id: string;
  position: DropPosition;
}

/** Which axis reordering should measure along, based on how `parent`'s children are actually laid out. */
function axisFor(parentEl: Element): "vertical" | "horizontal" {
  const style = window.getComputedStyle(parentEl);
  if ((style.display === "flex" || style.display === "inline-flex") && style.flexDirection.startsWith("row")) {
    return "horizontal";
  }
  return "vertical";
}

export function mountCanvas(
  editor: Editor,
  container: HTMLElement,
  onSelect: (id: string, additive: boolean) => void,
  onContextMenu: (id: string, clientX: number, clientY: number) => void,
): CanvasController {
  const registry = buildRegistry(editor, onSelect, onContextMenu);
  const renderer = renderToDom(editor.getDocument(), container, { registry, selection: editor.selection.get() });

  const indicator = document.createElement("div");
  indicator.className = "eb-drop-indicator";
  indicator.hidden = true;
  container.appendChild(indicator);

  let hover: HoverTarget | null = null;
  let insideTargetEl: HTMLElement | null = null;

  const clearHover = (): void => {
    hover = null;
    indicator.hidden = true;
    if (insideTargetEl) {
      insideTargetEl.classList.remove("eb-drop-target");
      insideTargetEl = null;
    }
  };

  const positionIndicator = (targetEl: HTMLElement, position: DropPosition): void => {
    if (insideTargetEl && insideTargetEl !== targetEl) insideTargetEl.classList.remove("eb-drop-target");

    if (position === "inside") {
      indicator.hidden = true;
      targetEl.classList.add("eb-drop-target");
      insideTargetEl = targetEl;
      return;
    }
    if (insideTargetEl) {
      insideTargetEl.classList.remove("eb-drop-target");
      insideTargetEl = null;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const axis = targetEl.parentElement ? axisFor(targetEl.parentElement) : "vertical";
    indicator.hidden = false;

    if (axis === "horizontal") {
      indicator.classList.add("eb-drop-indicator--vertical-line");
      indicator.classList.remove("eb-drop-indicator--horizontal-line");
      const x = position === "before" ? targetRect.left : targetRect.right;
      indicator.style.left = `${x - containerRect.left + container.scrollLeft}px`;
      indicator.style.top = `${targetRect.top - containerRect.top + container.scrollTop}px`;
      indicator.style.width = "0px";
      indicator.style.height = `${targetRect.height}px`;
    } else {
      indicator.classList.add("eb-drop-indicator--horizontal-line");
      indicator.classList.remove("eb-drop-indicator--vertical-line");
      const y = position === "before" ? targetRect.top : targetRect.bottom;
      indicator.style.left = `${targetRect.left - containerRect.left + container.scrollLeft}px`;
      indicator.style.top = `${y - containerRect.top + container.scrollTop}px`;
      indicator.style.width = `${targetRect.width}px`;
      indicator.style.height = "0px";
    }
  };

  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    const targetEl = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-eugine-id]") : null;
    if (!targetEl || !targetEl.dataset.eugineId) {
      clearHover();
      return;
    }

    const hoveredId = targetEl.dataset.eugineId;
    const hoveredType = targetEl.dataset.eugineType ?? "";
    const document_ = editor.getDocument();
    const acceptsChildren = editor.registry.tryGet(hoveredType)?.accepts !== "none";
    const isRoot = hoveredId === document_.rootId;

    const position: DropPosition = isRoot
      ? "inside"
      : getDropPosition(
          targetEl.getBoundingClientRect(),
          { clientX: event.clientX, clientY: event.clientY },
          { insideRatio: acceptsChildren ? 0.5 : 0, axis: targetEl.parentElement ? axisFor(targetEl.parentElement) : "vertical" },
        );

    hover = { id: hoveredId, position };
    positionIndicator(targetEl, position);
  };

  const onDragLeave = (event: DragEvent): void => {
    if (!container.contains(event.relatedTarget as Node | null)) clearHover();
  };

  container.addEventListener("dragover", onDragOver);
  container.addEventListener("dragleave", onDragLeave);
  document.addEventListener("dragend", clearHover);

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    const currentHover = hover;
    clearHover();

    // Everything below reads live document state to resolve the drop target,
    // which can throw in edge cases (e.g. a stale reference to a node
    // removed by an intervening change). Keep the whole computation inside
    // the try so any such error is swallowed like a rejected drop, not an
    // uncaught crash.
    try {
      const newType = event.dataTransfer?.getData(NEW_COMPONENT_MIME) || undefined;
      const movedId = event.dataTransfer?.getData(MOVE_NODE_MIME) || undefined;
      const childType = newType ?? (movedId ? getNode(editor.getDocument(), movedId).type : undefined);
      if (!childType) return;
      if (movedId && currentHover?.id === movedId) return; // no-op: dropped onto itself

      const document_ = editor.getDocument();
      const hoveredId = currentHover?.id ?? document_.rootId;
      const position = currentHover?.position ?? "inside";
      const hoveredParent = getParent(document_, hoveredId);

      let parentId: string;
      let index: number | undefined;

      if (position === "inside" || !hoveredParent) {
        parentId = resolveDropParent(editor, hoveredId, childType);
        index = undefined;
      } else if (
        editor.registry.canAcceptChild({
          parentType: hoveredParent.type,
          childType,
          currentChildCount: hoveredParent.children.length,
        })
      ) {
        parentId = hoveredParent.id;
        const siblings = movedId ? hoveredParent.children.filter((id) => id !== movedId) : hoveredParent.children;
        const hoverIndex = siblings.indexOf(hoveredId);
        index = position === "after" ? hoverIndex + 1 : hoverIndex;
      } else {
        parentId = resolveDropParent(editor, hoveredId, childType);
        index = undefined;
      }

      if (newType) {
        const id = editor.insert(newType, parentId, { index });
        onSelect(id, false);
      } else if (movedId) {
        editor.move(movedId, parentId, index);
        onSelect(movedId, false);
      }
    } catch (error) {
      console.warn("[playground] drop rejected:", error);
    }
  };

  container.addEventListener("drop", onDrop);
  const onCanvasClick = () => editor.selection.clear();
  container.addEventListener("click", onCanvasClick);

  return {
    renderer,
    refresh: () => renderer.update(editor.getDocument()),
    destroy: () => {
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("dragleave", onDragLeave);
      container.removeEventListener("drop", onDrop);
      container.removeEventListener("click", onCanvasClick);
      document.removeEventListener("dragend", clearHover);
      indicator.remove();
    },
  };
}

export function registerPaletteDrag(el: HTMLElement, type: string): void {
  el.draggable = true;
  el.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData(NEW_COMPONENT_MIME, type);
    event.dataTransfer!.effectAllowed = "copy";
  });
}

export const PALETTE_ITEMS = COMPONENT_SCHEMAS.filter((s) => s.paletteVisible);
