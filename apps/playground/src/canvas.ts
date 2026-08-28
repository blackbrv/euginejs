import { ComponentRegistry, getAncestors, getNode, type Editor, type EugineNode } from "eugine";
import { renderToDom, type DomComponentRenderer, type DomRenderer } from "eugine/renderer";
import { COMPONENT_SCHEMAS } from "./schema.js";

const NEW_COMPONENT_MIME = "application/x-eugine-new-component";
const MOVE_NODE_MIME = "application/x-eugine-move-node";

/** Walks up from `hoveredId` to the nearest ancestor (inclusive) that accepts `childType`. */
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

function makeInteractive(el: HTMLElement, node: EugineNode, editor: Editor, onSelect: (id: string) => void): void {
  el.dataset.eugineId = node.id;
  el.dataset.eugineType = node.type;
  el.classList.add("eb-node");

  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(node.id);
  });

  if (node.id !== editor.getDocument().rootId) {
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
    el.classList.add("eb-drop-target");
  });
  el.addEventListener("dragleave", () => el.classList.remove("eb-drop-target"));
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.classList.remove("eb-drop-target");

    const newType = event.dataTransfer?.getData(NEW_COMPONENT_MIME);
    const movedId = event.dataTransfer?.getData(MOVE_NODE_MIME);

    try {
      if (newType) {
        const parentId = resolveDropParent(editor, node.id, newType);
        const id = editor.insert(newType, parentId);
        onSelect(id);
      } else if (movedId) {
        const parentId = resolveDropParent(editor, node.id, getNode(editor.getDocument(), movedId).type);
        editor.move(movedId, parentId);
        onSelect(movedId);
      }
    } catch (error) {
      console.warn("[playground] drop rejected:", error);
    }
  });
}

function buildRegistry(editor: Editor, onSelect: (id: string) => void): ComponentRegistry<DomComponentRenderer> {
  const registry = new ComponentRegistry<DomComponentRenderer>();

  registry.register({
    type: "root",
    render: (_props, children, ctx) => {
      const el = document.createElement("div");
      el.className = "eb-canvas-root";
      children.forEach((c) => el.appendChild(c));
      makeInteractive(el, ctx.node, editor, onSelect);
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
      makeInteractive(el, ctx.node, editor, onSelect);
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
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });

  registry.register({
    type: "heading",
    render: (props, _children, ctx) => {
      const el = document.createElement("h2");
      el.className = "eb-heading";
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect);
      return el;
    },
  });

  registry.register({
    type: "text",
    render: (props, _children, ctx) => {
      const el = document.createElement("p");
      el.className = "eb-text";
      el.textContent = String(props.content ?? "");
      makeInteractive(el, ctx.node, editor, onSelect);
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
      makeInteractive(el, ctx.node, editor, onSelect);
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
      makeInteractive(el, ctx.node, editor, onSelect);
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
}

export function mountCanvas(editor: Editor, container: HTMLElement, onSelect: (id: string) => void): CanvasController {
  const registry = buildRegistry(editor, onSelect);
  const renderer = renderToDom(editor.getDocument(), container, { registry, selection: editor.selection.get() });

  container.addEventListener("dragover", (event) => event.preventDefault());
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    const newType = event.dataTransfer?.getData(NEW_COMPONENT_MIME);
    const movedId = event.dataTransfer?.getData(MOVE_NODE_MIME);
    try {
      if (newType) {
        const id = editor.insert(newType, editor.getDocument().rootId);
        onSelect(id);
      } else if (movedId) {
        editor.move(movedId, editor.getDocument().rootId);
      }
    } catch (error) {
      console.warn("[playground] root drop rejected:", error);
    }
  });

  return {
    renderer,
    refresh: () => renderer.update(editor.getDocument()),
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
