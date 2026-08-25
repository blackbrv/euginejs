import { ComponentRegistry, EugineError, getNode } from "@eugine/core";
import type { EugineDocument, EugineNode, NodeProps } from "@eugine/core";
import { escapeAttribute, escapeHtml } from "./sanitize.js";

export interface HtmlRenderContext<TData = unknown> {
  node: EugineNode;
  data: TData | undefined;
  /** Render an arbitrary node id through the same renderer (rarely needed by simple components). */
  renderNode: (id: string) => string;
}

/**
 * A component's HTML renderer: given its (already-defaulted) props and its
 * children already rendered to HTML, return this node's HTML string.
 */
export type HtmlComponentRenderer<TData = unknown> = (
  props: NodeProps,
  childrenHtml: string,
  context: HtmlRenderContext<TData>,
) => string;

export type OnMissingComponent = "throw" | "omit" | "placeholder";

export interface RenderToStringOptions<TData = unknown> {
  registry: ComponentRegistry<HtmlComponentRenderer<TData>>;
  data?: TData;
  /** What to do when a node's type has no registered definition. Defaults to "placeholder". */
  onMissingComponent?: OnMissingComponent;
}

/**
 * Renders an EugineDocument to a deterministic HTML string. Never touches
 * `window`/`document`/browser APIs, and never resolves a component by
 * dynamically importing anything named in the document — every node's
 * `type` is resolved strictly against the supplied ComponentRegistry (see
 * "Component Registry as Security Boundary" in the PRD).
 */
export function renderToString<TData = unknown>(
  document: EugineDocument,
  options: RenderToStringOptions<TData>,
): string {
  const onMissing = options.onMissingComponent ?? "placeholder";

  function renderNode(id: string): string {
    const node = getNode(document, id);
    if (node.hidden) return "";

    const childrenHtml = node.children.map(renderNode).join("");
    const definition = options.registry.tryGet(node.type);

    if (!definition) {
      switch (onMissing) {
        case "throw":
          throw new EugineError("EUGINE_RENDER_FAILED", `No component registered for type "${node.type}".`, {
            context: { id: node.id, type: node.type },
          });
        case "omit":
          return "";
        case "placeholder":
        default:
          return `<!-- eugine:unknown-component type="${escapeHtml(node.type)}" id="${escapeHtml(node.id)}" -->`;
      }
    }

    if (typeof definition.render === "function") {
      return definition.render(node.props, childrenHtml, { node, data: options.data, renderNode });
    }

    return renderFallback(node, childrenHtml);
  }

  return renderNode(document.rootId);
}

/** Structural fallback used when a registered component has no `render` implementation. */
function renderFallback(node: EugineNode, childrenHtml: string): string {
  const classAttr = node.className ? ` class="${escapeAttribute(node.className)}"` : "";
  return `<div data-eugine-id="${escapeAttribute(node.id)}" data-eugine-type="${escapeAttribute(node.type)}"${classAttr}>${childrenHtml}</div>`;
}
