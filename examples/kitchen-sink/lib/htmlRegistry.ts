import { ComponentRegistry } from "eugine";
import { escapeAttribute, escapeHtml, sanitizeUrl, type HtmlComponentRenderer } from "eugine/server";

export function createHtmlRegistry(): ComponentRegistry<HtmlComponentRenderer> {
  const registry = new ComponentRegistry<HtmlComponentRenderer>();

  registry.register({ type: "root", render: (_p, children) => `<div class="ks-page">${children}</div>` });
  registry.register({ type: "section", render: (_p, children) => `<section class="ks-section">${children}</section>` });
  registry.register({ type: "container", render: (_p, children) => `<div class="ks-container">${children}</div>` });
  registry.register({ type: "grid", render: (_p, children) => `<div class="ks-grid">${children}</div>` });
  registry.register({
    type: "card",
    render: (props, children) => `<div class="ks-card"><h3>${escapeHtml(props.title)}</h3>${children}</div>`,
  });
  registry.register({ type: "heading", render: (props) => `<h2>${escapeHtml(props.content)}</h2>` });
  registry.register({ type: "text", render: (props) => `<p>${escapeHtml(props.content)}</p>` });
  registry.register({
    type: "button",
    render: (props) => {
      const href = sanitizeUrl(props.href) ?? "#";
      return `<a class="ks-button" href="${escapeAttribute(href)}">${escapeHtml(props.label)}</a>`;
    },
  });

  return registry;
}
