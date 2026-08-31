import { ComponentRegistry, createEditor } from "eugine";
import { getDropPosition, renderToDom, type DomComponentRenderer } from "eugine/renderer";

const editor = createEditor({ components: [{ type: "section", accepts: "*" }] });

const registry = new ComponentRegistry<DomComponentRenderer>();
registry.registerOrReplace({
  type: "root",
  render: (_props, children) => {
    const el = document.createElement("div");
    for (const child of children) el.appendChild(child);
    return el;
  },
});
registry.registerOrReplace({
  type: "section",
  render: (_props, children) => {
    const el = document.createElement("section");
    for (const child of children) el.appendChild(child);
    return el;
  },
});

// #region mount
// @eugine/renderer only ever touches `globalThis.document.createElement` /
// `createComment` — no `window` reference, no same-origin assumption, no
// drag-event wiring — so mounting into a same-origin iframe's own document
// needs no library changes. Call this once the iframe has finished loading
// (its `load` event has fired), so `contentDocument` is populated.
export function mountInIframe(iframe: HTMLIFrameElement) {
  const iframeDocument = iframe.contentDocument;
  if (!iframeDocument) {
    throw new Error("Iframe must be same-origin and finished loading before mounting.");
  }

  const renderer = renderToDom(editor.getDocument(), iframeDocument.body, { registry });

  // The editor instance lives in the parent's script context; only the
  // rendered DOM lives inside the iframe. "document.change" alone is enough
  // here — editor.load() (e.g. from @eugine/versioning's restoreVersion())
  // still fires it, since it writes through the same DocumentStore.set()
  // that every other mutation does, in addition to its own "document.load".
  const off = editor.events.on("document.change", ({ document }) => renderer.update(document));

  return () => {
    off();
    renderer.destroy();
  };
}
// #endregion mount

// #region coordinates
// getDropPosition() is pure geometry (see @eugine/renderer's dragDrop.ts) —
// it just needs `rect` and `pointer` expressed in the SAME coordinate space.
// A pointer/drag event captured on the PARENT window reports clientX/clientY
// relative to the parent's viewport; an element living *inside* the iframe
// reports getBoundingClientRect() relative to the iframe's own viewport.
// Translate one into the other's space before comparing them — this is only
// needed when the pointer and the target element are in different documents
// (e.g. dragging a component from a parent-side palette into the canvas);
// a drag that starts and ends inside the iframe needs no translation at all.
export function toIframeRelativePointer(
  iframe: HTMLIFrameElement,
  parentPointer: { clientX: number; clientY: number },
): { clientX: number; clientY: number } {
  const frameRect = iframe.getBoundingClientRect();
  return {
    clientX: parentPointer.clientX - frameRect.left,
    clientY: parentPointer.clientY - frameRect.top,
  };
}

export function classifyDropInsideIframe(
  iframe: HTMLIFrameElement,
  targetElement: Element,
  parentPointer: { clientX: number; clientY: number },
) {
  const pointer = toIframeRelativePointer(iframe, parentPointer);
  return getDropPosition(targetElement.getBoundingClientRect(), pointer);
}
// #endregion coordinates
