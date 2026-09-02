import { ComponentRegistry, type EugineDocument, type EugineNode } from "eugine";
import { escapeAttribute, escapeHtml, renderToString, sanitizeUrl, type HtmlComponentRenderer } from "eugine/server";
import { stylesToCssText } from "./styleFields.js";

/** The design panel's styles become an inline `style="..."` attribute, kept in sync with the canvas. */
function styleAttr(node: EugineNode): string {
  const css = stylesToCssText(node.styles);
  return css ? ` style="${escapeAttribute(css)}"` : "";
}

function buildHtmlRegistry(): ComponentRegistry<HtmlComponentRenderer> {
  const registry = new ComponentRegistry<HtmlComponentRenderer>();

  registry.register({
    type: "root",
    render: (_p, children, ctx) => `<div class="eb-canvas-root"${styleAttr(ctx.node)}>${children}</div>`,
  });
  registry.register({
    type: "section",
    render: (props, children, ctx) =>
      `<section class="eb-section ${escapeAttribute(props.className ?? "")}"${styleAttr(ctx.node)}>${children}</section>`,
  });
  registry.register({
    type: "container",
    render: (props, children, ctx) =>
      `<div class="eb-container ${escapeAttribute(props.className ?? "")}"${styleAttr(ctx.node)}>${children}</div>`,
  });
  registry.register({
    type: "heading",
    render: (props, _children, ctx) => `<h2 class="eb-heading"${styleAttr(ctx.node)}>${escapeHtml(props.content)}</h2>`,
  });
  registry.register({
    type: "text",
    render: (props, _children, ctx) => `<p class="eb-text"${styleAttr(ctx.node)}>${escapeHtml(props.content)}</p>`,
  });
  registry.register({
    type: "button",
    render: (props, _children, ctx) => {
      const href = sanitizeUrl(props.href) ?? "#";
      return `<a class="eb-button" href="${escapeAttribute(href)}"${styleAttr(ctx.node)}>${escapeHtml(props.label)}</a>`;
    },
  });
  registry.register({
    type: "image",
    render: (props, _children, ctx) => {
      const src = sanitizeUrl(props.src) ?? "";
      return `<img class="eb-image" src="${escapeAttribute(src)}" alt="${escapeAttribute(props.alt)}"${styleAttr(ctx.node)} />`;
    },
  });

  return registry;
}

/**
 * Renders the document to an HTML fragment using @euginejs/renderer-server —
 * the SAME server-safe renderer a Node.js backend would use, running here in
 * the browser only because it happens to have zero browser-API dependencies.
 */
export function exportDocumentToHtml(document: EugineDocument): string {
  return renderToString(document, { registry: buildHtmlRegistry() });
}

/**
 * A clean, standalone stylesheet for the *exported* page — deliberately
 * separate from the editor UI's own style.css (which also styles the
 * palette, toolbar, layers panel, drop indicators, etc. that a published
 * page has no use for).
 */
export const EXPORT_CSS = `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  background: #ffffff;
  line-height: 1.5;
}

.eb-canvas-root {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 24px;
}

.eb-section,
.eb-container {
  padding: 24px;
  margin-bottom: 16px;
}

.eb-heading {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 12px;
}

.eb-text {
  margin: 0 0 12px;
  color: #3a3a3a;
}

.eb-button {
  display: inline-block;
  padding: 10px 20px;
  background: #4f46e5;
  color: #ffffff;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}

.eb-image {
  max-width: 100%;
  border-radius: 8px;
  display: block;
}
`;

/** Wraps a rendered body fragment in a complete, standalone HTML document. */
export function buildStandaloneHtmlDocument(bodyHtml: string, title = "Exported page"): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>
`;
}
