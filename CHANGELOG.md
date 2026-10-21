# Changelog

All `@euginejs/*` packages and `eugine` are versioned together. While Eugine is on 0.x, a minor
bump (0.1 → 0.2) may contain breaking changes; patch bumps never do.

## 0.2.0

Every package moves to 0.2.0 and depends on `@euginejs/core@^0.2.0`. Upgrade them together: on
0.x, `^0.1.x` does not match 0.2.0, so mixing versions installs two copies of core.

### Breaking changes

**@euginejs/core**

- `editor.replace(id, next)` throws `EUGINE_DOCUMENT_INVALID` if `next.children` differs from the
  node's current children. Change children with `insert`/`move`/`remove`/`reorder`. `replaceNode()`
  and remote `replace` operations always keep the node's live children.
- `locked` is enforced everywhere: removing an *ancestor* of a locked node, unwrapping a locked
  node, and changing a locked node's type through `replace()` now throw `EUGINE_INVALID_DROP`.
  Toggling `locked`/`hidden` through `replace()` still works.
- `duplicate`, `pasteSubtree`, `wrap`, `unwrap` and `replace` now enforce `accepts`/`maxChildren`
  and throw for unregistered types — previously only `insert` and `move` did. A pasted snapshot
  must use only registered types.
- Moving a node into its own subtree through `editor.move()` throws `EUGINE_INVALID_DROP` (was
  `EUGINE_DOCUMENT_INVALID`).
- `validateDocument()` rejects nodes not reachable from the root and a child listed twice under one
  parent. Stored documents containing orphaned nodes will no longer load.
- `reorder()` rejects a repeated child id.
- Loading a document whose `schemaVersion` is newer than this build supports throws
  `EUGINE_MIGRATION_FAILED` instead of loading as-is.
- `history.onCommit()` also fires for undo and redo, with a new `kind: "execute" | "undo" | "redo"`
  field. An undo carries the inverse operations it applied, so collaborators stay in sync. If you
  use `onCommit` for anything besides sending operations, filter on `kind`.
- `history.onChange()` fires with `kind: "clear"` and `transaction: null` when history is cleared,
  including inside `editor.load()`. The payload type is now a union — check `kind` before reading
  `transaction`.
- `node.create` / `node.delete` fire once for every node entering or leaving the document — paste,
  duplicate, wrap/unwrap, undo/redo and remote operations included, descendants included — but not
  for `editor.load()`. `node.delete`'s payload gains `node`.
- `editor.save()` sends `editor.getBaseRevision()` (the revision last loaded or saved) as
  `baseRevision`, not the local edit counter. A client that never loaded the stored document now
  gets a conflict instead of overwriting it.

**@euginejs/renderer-server**

- `attributesToHtml()` drops every attribute starting with `on`, not just known event handlers —
  inert props such as `once` or `onSurface` are dropped too.
- An unregistered component type with the default `onMissingComponent: "placeholder"` renders a
  `<div data-eugine-id data-eugine-type>` wrapper around its children, matching the DOM renderer,
  instead of an HTML comment that dropped the whole subtree.
- `renderToString()` validates the document first and throws `EUGINE_DOCUMENT_INVALID` for a
  corrupt one, instead of overflowing the stack on a cycle.

**@euginejs/renderer**

- `update()` after `destroy()` does nothing.

### Added

- `editor.canInsert(type, parentId)` and `editor.canMove(id, parentId)`: the exact checks
  `insert()`/`move()` run, without changing anything — for drag-over feedback.
- `editor.getBaseRevision()`.
- `context.onCleanup(fn)` for DOM component renderers: runs once when the element is rebuilt, the
  node leaves the document, or the renderer is destroyed.
- `transactionToUndoOperations()` and an optional `Command.toUndoOperations()` for custom commands
  that should broadcast their undo.

### Fixed

- **Security:** `sanitizeUrl()` caught `javascript:` URLs prefixed with control characters
  (`"\x01javascript:..."`) only after the browser had already stripped them; it now strips them
  first.
- **Data loss:** a `history.transaction()` that threw part-way left its edits applied with no undo
  entry; it now rolls back.
- **Data loss:** two clients could silently overwrite each other's saves (see `getBaseRevision`).
- **Sync:** `applyRemote()` threw on ordinary races (concurrent moves forming a cycle, a remote
  delete of the root) and on malformed operations; under the default `"drop"` policy they are now
  skipped and reported in `dropped`. `isEugineOperation()` checks each operation's full shape.
  Operations creating a `__proto__` node still throw.
- Undoing an `unwrap` restores the wrapper's `locked`/`hidden`/`editable` flags.
- Autosave writes are queued, so an older save can no longer land after a newer one.
- CommonJS consumers now get `.d.cts` type declarations (previously "masquerading as ESM").
- Internal package dependencies use caret ranges instead of exact pins.
