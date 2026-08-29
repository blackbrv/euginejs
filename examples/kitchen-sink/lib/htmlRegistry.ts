import { ComponentRegistry, type EugineNode } from "eugine";
import { escapeAttribute, escapeHtml, sanitizeUrl, type HtmlComponentRenderer } from "eugine/server";
import { stylesToCssText } from "./styleFields";

/** The design panel's styles become an inline `style="..."` attribute, kept in sync with the canvas. */
function styleAttr(node: EugineNode): string {
  const css = stylesToCssText(node.styles);
  return css ? ` style="${escapeAttribute(css)}"` : "";
}

export function createHtmlRegistry(): ComponentRegistry<HtmlComponentRenderer> {
  const registry = new ComponentRegistry<HtmlComponentRenderer>();

  registry.register({ type: "root", render: (_p, children, ctx) => `<div class="ks-page"${styleAttr(ctx.node)}>${children}</div>` });
  registry.register({
    type: "section",
    render: (_p, children, ctx) => `<section class="ks-section"${styleAttr(ctx.node)}>${children}</section>`,
  });
  registry.register({
    type: "container",
    render: (_p, children, ctx) => `<div class="ks-container"${styleAttr(ctx.node)}>${children}</div>`,
  });
  registry.register({ type: "grid", render: (_p, children, ctx) => `<div class="ks-grid"${styleAttr(ctx.node)}>${children}</div>` });
  registry.register({
    type: "card",
    render: (props, children, ctx) => `<div class="ks-card"${styleAttr(ctx.node)}><h3>${escapeHtml(props.title)}</h3>${children}</div>`,
  });
  registry.register({
    type: "heading",
    render: (props, _children, ctx) => `<h2${styleAttr(ctx.node)}>${escapeHtml(props.content)}</h2>`,
  });
  registry.register({
    type: "text",
    render: (props, _children, ctx) => `<p${styleAttr(ctx.node)}>${escapeHtml(props.content)}</p>`,
  });
  registry.register({
    type: "button",
    render: (props, _children, ctx) => {
      const href = sanitizeUrl(props.href) ?? "#";
      return `<a class="ks-button" href="${escapeAttribute(href)}"${styleAttr(ctx.node)}>${escapeHtml(props.label)}</a>`;
    },
  });

  return registry;
}
