import { ComponentRegistry, createEditor } from "eugine";
import { renderToDom, type DomComponentRenderer } from "eugine/renderer";
import { renderToPage, renderToString, type HtmlComponentRenderer } from "eugine/server";

const editor = createEditor({ components: [{ type: "section", accepts: "*" }] });

// #region server
// renderToString never touches window/document, so it is safe in a Server
// Component. Component types resolve strictly against the registry — a
// renderer never imports anything named inside untrusted document JSON.
const htmlRegistry = new ComponentRegistry<HtmlComponentRenderer>();
htmlRegistry.registerOrReplace({ type: "root", render: (_props, childrenHtml) => childrenHtml });
htmlRegistry.registerOrReplace({
  type: "section",
  render: (props, childrenHtml) => `<section>${childrenHtml}</section>`,
});

export function toHtml(): string {
  return renderToString(editor.getDocument(), { registry: htmlRegistry });
}
// #endregion server

// #region export
// renderToString() returns a fragment — exactly what an existing page's
// template needs, and exactly what would double-wrap a root component that
// already renders a full layout. renderToPage() is the other case: a
// byte-ready, standalone .html file. It calls renderToString() internally
// with the same options, then adds the <!doctype html>/<head>/<body> shell.
export function exportStandalonePage(): string {
  return renderToPage(editor.getDocument(), {
    registry: htmlRegistry,
    title: "My site",
    css: "body { font-family: sans-serif; margin: 0; }",
  });
}
// #endregion export

// #region dom
// The DOM renderer takes a DIFFERENT registry: its renderers return a Node,
// not a string, so the two contracts are not interchangeable.
const domRegistry = new ComponentRegistry<DomComponentRenderer>();
domRegistry.registerOrReplace({
  type: "root",
  render: (_props, children) => {
    const el = document.createElement("div");
    for (const child of children) el.appendChild(child);
    return el;
  },
});
domRegistry.registerOrReplace({
  type: "section",
  render: (props, children) => {
    const el = document.createElement("section");
    for (const child of children) el.appendChild(child);
    return el;
  },
});

export function mount(container: Element) {
  const renderer = renderToDom(editor.getDocument(), container, { registry: domRegistry });

  // update() patches only the nodes whose data actually changed, because tree
  // operations reuse the object identity of everything they did not touch.
  const off = editor.events.on("document.change", ({ document }) => renderer.update(document));

  return () => {
    off();
    renderer.destroy();
  };
}
// #endregion dom
