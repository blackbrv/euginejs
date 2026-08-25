# @eugine/core

The core engine behind Eugine: a document model, component
registry, command/history system, selection state, serialization and a plugin runtime for building
your own drag-and-drop visual editor.

This package has **no dependency on React, the DOM, or any specific styling library**. It is the
layer described in the Eugine PRD as "the engine" — you build the UI around it.

```bash
npm install @eugine/core
# or, for the whole family (core + renderer + renderer-server):
npm install eugine
```

## Quick start

```ts
import { createEditor } from "@eugine/core";

const editor = createEditor({
  components: [
    { type: "section", accepts: "*" },
    { type: "text", accepts: "none", defaults: { props: { content: "Hello world" } } },
  ],
});

const root = editor.getDocument().rootId;
const heroId = editor.insert("section", root);
editor.insert("text", heroId);

editor.history.undo();
editor.history.redo();

const json = editor.serialize(); // canonical, versioned document JSON
editor.load(json);
```

See the repository root README for the full architecture overview, and `@eugine/renderer` /
`@eugine/renderer-server` for rendering a document to the browser or to an HTML string.
