import { ComponentRegistry } from "eugine";
import { escapeHtml, type HtmlComponentRenderer } from "eugine/server";

/**
 * The server-side render registry. This never runs in the browser: the
 * whole point of eugine/server is that it has zero DOM/window dependency,
 * so it's safe to import directly into a Server Component.
 */
export function createHtmlRegistry(): ComponentRegistry<HtmlComponentRenderer> {
  const registry = new ComponentRegistry<HtmlComponentRenderer>();

  registry.register({ type: "root", render: (_props, children) => `<div class="page">${children}</div>` });
  registry.register({ type: "section", render: (_props, children) => `<section class="section">${children}</section>` });
  registry.register({ type: "heading", render: (props) => `<h1>${escapeHtml(props.content)}</h1>` });
  registry.register({ type: "text", render: (props) => `<p>${escapeHtml(props.content)}</p>` });

  return registry;
}
