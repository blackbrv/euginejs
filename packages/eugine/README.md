# eugine

> Build your editor your way. Eugine provides the engine.

Eugine is an extensible engine for building drag-and-drop visual editors and page builders —
without implementing the document model, drag-and-drop, undo/redo, serialization and rendering
plumbing from scratch.

```bash
npm install eugine
```

```ts
import { createEditor } from "eugine";

const editor = createEditor({
  components: [
    { type: "section", accepts: "*" },
    { type: "text", accepts: "none" },
  ],
});

const heroId = editor.insert("section", editor.getDocument().rootId);
editor.insert("text", heroId, { props: { content: "Hello world" } });

const document = editor.serialize(); // canonical, versioned JSON — your persistence source of truth
```

Render the same document in the browser or on the server, from a shared component registry:

```ts
import { renderToDom } from "eugine/renderer"; // browser, incremental DOM updates
import { renderToString } from "eugine/server"; // Node.js / SSR, zero browser APIs
```

See the repository root README for the full architecture, or `@euginejs/core`, `@euginejs/renderer`
and `@euginejs/renderer-server` individually if you only need one piece.
