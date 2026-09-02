# @euginejs/renderer

A browser DOM renderer for Eugine documents. Renders an
`EugineDocument` into a container element and, on subsequent `update()` calls, patches only the
DOM nodes whose underlying data actually changed instead of re-rendering the whole tree.

```bash
npm install @euginejs/renderer @euginejs/core
```

```ts
import { ComponentRegistry } from "@euginejs/core";
import { renderToDom, type DomComponentRenderer } from "@euginejs/renderer";

const registry = new ComponentRegistry<DomComponentRenderer>();
registry.register({
  type: "text",
  render: (props) => {
    const el = document.createElement("p");
    el.textContent = String(props.content ?? "");
    return el;
  },
});

const renderer = renderToDom(document_, container, { registry });
renderer.update(nextDocument); // only touches the nodes that changed
renderer.destroy();
```

This package requires DOM APIs and must only be used in the browser (or a DOM-emulated test
environment). For server-side rendering, use `@euginejs/renderer-server` instead.

## Selection marker

Eugine ships no default "selected" styling — instead the renderer exposes a marker your app
styles entirely itself, so selection can look like anything (an outline, a badge, a floating
toolbar) without touching the engine:

```ts
editor.selection.onSelectionChange(({ ids }) => renderer.setSelection(ids));
```

`setSelection()` toggles a `data-eugine-selected` attribute on the selected nodes' live elements
— no rebuild, so scroll position/focus/element identity are preserved. Style it with plain CSS:

```css
[data-eugine-selected] {
  outline: 2px solid #6366f1;
}
```

For more control than CSS alone gives you (e.g. rendering an extra badge element only when
selected), a component's `render` function also receives `context.selected: boolean` directly.
