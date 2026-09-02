# @euginejs/renderer-server

A deterministic, browser-API-free HTML renderer for Eugine documents. Safe to run in Node.js server contexts — including React Server Components / Next.js
App Router — without loading the visual editor at all.

```bash
npm install @euginejs/renderer-server @euginejs/core
```

```ts
import { ComponentRegistry } from "@euginejs/core";
import { renderToString, type HtmlComponentRenderer } from "@euginejs/renderer-server";

const registry = new ComponentRegistry<HtmlComponentRenderer>();
registry.register({ type: "root", render: (_props, children) => `<main>${children}</main>` });
registry.register({
  type: "text",
  render: (props) => `<p>${escapeHtml(props.content)}</p>`,
});

const html = renderToString(document, { registry, data: { user: { name: "James" } } });
```

`renderToString` returns a **fragment**, for embedding into an existing template. For a byte-ready,
standalone `.html` file (`<!doctype html>`/`<head>`/`<body>` and all), use `renderToPage` instead —
it calls `renderToString` internally with the same options and wraps the result:

```ts
import { renderToPage } from "@euginejs/renderer-server";

const page = renderToPage(document, {
  registry,
  title: "My site",
  css: "body { font-family: sans-serif; }",
});
```

## Security

Every node's `type` is resolved strictly against the `ComponentRegistry` you pass in — this
package **never** dynamically imports or executes anything named inside a document. Unknown
component types are handled via `onMissingComponent: "throw" | "omit" | "placeholder"` (default:
`"placeholder"`, which renders an inert, escaped HTML comment). Use the exported `escapeHtml`,
`escapeAttribute` and `sanitizeUrl` helpers when writing your own component renderers to avoid
script injection from document-provided text/URLs.
