import { ComponentRegistry, createEditor } from "eugine";
import { renderToDom, type DomComponentRenderer } from "eugine/renderer";
import { renderToString, type HtmlComponentRenderer } from "eugine/server";

const editor = createEditor({ components: [{ type: "section", accepts: "*" }] });

// #region server
// renderToString never touches window/document, so it is safe in a Server
// Component. Component types resolve strictly against the registry — a
// renderer never imports anything named inside untrusted document JSON.
const htmlRegistry = new ComponentRegistry<HtmlComponentRenderer>();
htmlRegistry.registerOrReplace({
  type: "section",
  render: (props, childrenHtml) => `<section>${childrenHtml}</section>`,
});

export function toHtml(): string {
  return renderToString(editor.getDocument(), { registry: htmlRegistry });
}
// #endregion server

// #region dom
// The DOM renderer takes a DIFFERENT registry: its renderers return a Node,
// not a string, so the two contracts are not interchangeable.
const domRegistry = new ComponentRegistry<DomComponentRenderer>();
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
