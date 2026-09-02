# @euginejs/core

The core engine behind Eugine: a document model, component
registry, command/history system, selection state, serialization and a plugin runtime for building
your own drag-and-drop visual editor.

This package has **no dependency on React, the DOM, or any specific styling library**. It is the
layer described in the Eugine PRD as "the engine" — you build the UI around it.

```bash
npm install @euginejs/core
# or, for the whole family (core + renderer + renderer-server):
npm install eugine
```

## Quick start

```ts
import { createEditor } from "@euginejs/core";

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

## Multiple users on one document

Core does not ship a transport, but it gives you the seams to build one, and it is safe to have
more than one author. Two things make that work.

**Operations are the wire format.** Every committed transaction serializes to plain JSON data you
can send anywhere. Never ship the whole document — that is last-write-wins by another name.

```ts
const editor = createEditor({
  clientId: "user-42",
  // Client-scoped ids, so two browsers can never mint the same one.
  idFactory: () => `user-42_${crypto.randomUUID()}`,
});

// Outbound: everything this client does, as data.
editor.history.onCommit(({ operations }) => {
  if (operations) socket.send(JSON.stringify(operations));
});

// Inbound: apply what everyone else did.
socket.onmessage = (event) => {
  const operations: unknown = JSON.parse(event.data);
  editor.applyRemote(operations as EugineOperation[], { clientId: "user-7" });
};
```

`applyRemote()` deliberately does **not** touch the undo stack — a remote edit landing there means
the local user's next Ctrl+Z reverts a colleague's work. It also drops (rather than throws on)
operations whose target no longer exists, since a remote op arriving for a node this client just
deleted is an ordinary race; the dropped ones come back in the result if you care.

**Saves are versioned.** Use `editor.save()` rather than `editor.storage.save(editor.serialize())`:
it tags the write with the revision it was based on so your adapter can refuse to overwrite a
newer one.

```ts
const result = await editor.save();
if (!result.ok) {
  // Someone saved after the revision we started from. `result.current` holds theirs.
}
```

Presence hangs off selection, which is deliberately separate from document state:

```ts
editor.events.on("node.select", ({ ids }) => presence.publish({ user: "user-42", ids }));
```

### What this is not

Per-client undo scoping is not full operational transformation. Undoing past a later remote edit
replays each command's inverse against the *current* document, which is safe — it will not clobber
a concurrent edit or throw — but it does not transform intent the way a CRDT or OT layer would. The
operation stream is the input either of those would consume; choosing between them is still open.

See the repository root README for the full architecture overview, and `@euginejs/renderer` /
`@euginejs/renderer-server` for rendering a document to the browser or to an HTML string.
