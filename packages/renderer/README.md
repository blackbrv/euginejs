# @eugine/renderer

A browser DOM renderer for Eugine documents. Renders an
`EugineDocument` into a container element and, on subsequent `update()` calls, patches only the
DOM nodes whose underlying data actually changed instead of re-rendering the whole tree.

```bash
npm install @eugine/renderer @eugine/core
```

```ts
import { ComponentRegistry } from "@eugine/core";
import { renderToDom, type DomComponentRenderer } from "@eugine/renderer";

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
environment). For server-side rendering, use `@eugine/renderer-server` instead.
