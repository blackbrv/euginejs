import { ComponentRegistry, getAncestors, getNode, type Editor, type EugineNode } from "eugine";
import { renderToDom, type DomComponentRenderer, type DomRenderer } from "eugine/renderer";
import { COMPONENT_SCHEMAS } from "./schema";

const NEW_COMPONENT_MIME = "application/x-eugine-new-component";
const MOVE_NODE_MIME = "application/x-eugine-move-node";

function resolveDropParent(editor: Editor, hoveredId: string, childType: string): string {
  const document = editor.getDocument();
  const chain = [getNode(document, hoveredId), ...getAncestors(document, hoveredId)];
  for (const candidate of chain) {
    if (editor.registry.canAcceptChild({ parentType: candidate.type, childType, currentChildCount: candidate.children.length })) {
      return candidate.id;
    }
  }
  return document.rootId;
}

function makeInteractive(
  el: HTMLElement,
  node: EugineNode,
  editor: Editor,
  onSelect: (id: string, additive: boolean) => void,
): void {
  el.dataset.eugineId = node.id;
  el.dataset.eugineType = node.type;
  el.classList.add("ks-node");
  if (node.locked) el.classList.add("ks-locked");

  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(node.id, event.shiftKey);
  });

  if (node.id !== editor.getDocument().rootId && !node.locked) {
    el.draggable = true;
    el.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      event.dataTransfer?.setData(MOVE_NODE_MIME, node.id);
      event.dataTransfer!.effectAllowed = "move";
    });
  }

  el.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.classList.add("ks-drop-target");
  });
  el.addEventListener("dragleave", () => el.classList.remove("ks-drop-target"));
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.classList.remove("ks-drop-target");

    const newType = event.dataTransfer?.getData(NEW_COMPONENT_MIME);
    const movedId = event.dataTransfer?.getData(MOVE_NODE_MIME);

    try {
      if (newType) {
        const parentId = resolveDropParent(editor, node.id, newType);
        const id = editor.insert(newType, parentId);
        onSelect(id, false);
      } else if (movedId) {
        const parentId = resolveDropParent(editor, node.id, getNode(editor.getDocument(), movedId).type);
        editor.move(movedId, parentId);
      }
    } catch (error) {
      console.warn("[kitchen-sink] drop rejected:", error);
    }
  });
}

function placeholder(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "ks-placeholder";
  el.textContent = text;
  return el;
}

function buildRegistry(editor: Editor, onSelect: (id: string, additive: boolean) => void): ComponentRegistry<DomComponentRenderer> {
  const registry = new ComponentRegistry<DomComponentRenderer>();

  const container = (tag: string, className: string, emptyText: string) =>
    ({
      render: (props: Record<string, unknown>, children: Node[], ctx: { node: EugineNode }) => {
        const el = document.createElement(tag);
        el.className = className;
        if (children.length === 0) el.appendChild(placeholder(emptyText));
        else children.forEach((c) => el.appendChild(c));
        makeInteractive(el, ctx.node, editor, onSelect);
        return el;
      },
    }) satisfies { render: DomComponentRenderer };

  registry.register({ type: "root", ...container("div", "ks-canvas-root", "Drag components here") });
  registry.register({ type: "section", ...container("section", "ks-section", "Drop into this section") });
  registry.register({ type: "container", ...container("div", "ks-container", "Drop into this container") });
  registry.register({ type: "grid", ...container("div", "ks-grid", "Drop up to 4 cards") });
  registry.register({
    type: "card",
    render: (props, children, ctx) => {
      const el = document.createElement("div");
      el.className = "ks-card";
      const title = document.createElement("h3");
      title.textContent = String(props.title ?? "");
      el.appendChild(title);
      if (children.length === 0) el.appendChild(placeholder("Drop into this card"));
      else children.forEach((c) => el.appendChild(c));
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });
  registry.register({
    type: "heading",
    render: (props, _c, ctx) => {
      const el = document.createElement("h2");
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });
  registry.register({
    type: "text",
    render: (props, _c, ctx) => {
      const el = document.createElement("p");
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });
  registry.register({
    type: "button",
    render: (props, _c, ctx) => {
      const el = document.createElement("a");
      el.className = "ks-button";
      el.textContent = String(props.label ?? "");
      el.href = String(props.href ?? "#");
      el.addEventListener("click", (event) => event.preventDefault());
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });

  return registry;
}

export interface CanvasController {
  renderer: DomRenderer;
  refresh(): void;
}

export function mountCanvas(
  editor: Editor,
  container: HTMLElement,
  onSelect: (id: string, additive: boolean) => void,
): CanvasController {
  const registry = buildRegistry(editor, onSelect);
  const renderer = renderToDom(editor.getDocument(), container, { registry });

  container.addEventListener("dragover", (event) => event.preventDefault());
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    const newType = event.dataTransfer?.getData(NEW_COMPONENT_MIME);
    const movedId = event.dataTransfer?.getData(MOVE_NODE_MIME);
    try {
      if (newType) {
        const id = editor.insert(newType, editor.getDocument().rootId);
        onSelect(id, false);
      } else if (movedId) {
        editor.move(movedId, editor.getDocument().rootId);
      }
    } catch (error) {
      console.warn("[kitchen-sink] root drop rejected:", error);
    }
  });

  return { renderer, refresh: () => renderer.update(editor.getDocument()) };
}

export function registerPaletteDrag(el: HTMLElement, type: string): void {
  el.draggable = true;
  el.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData(NEW_COMPONENT_MIME, type);
    event.dataTransfer!.effectAllowed = "copy";
  });
}

export const PALETTE_ITEMS = COMPONENT_SCHEMAS.filter((s) => s.paletteVisible);
