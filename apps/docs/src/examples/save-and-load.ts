import { createEditor, MemoryStorageAdapter } from "eugine";

const editor = createEditor({
  components: [{ type: "section", accepts: "*" }],
});

// #region serialize
// The canonical, versioned envelope: { schemaVersion, engine, engineVersion, document }
const snapshot = editor.serialize();
editor.load(snapshot);
// #endregion serialize

// #region adapter
editor.storage.use(new MemoryStorageAdapter());
// #endregion adapter

// #region save
// editor.save() attaches the revision this document was based on, so an
// adapter can refuse a write that would overwrite someone else's newer one.
export async function publish(): Promise<void> {
  const result = await editor.save();

  if (!result.ok) {
    // Another client saved after the revision we started from.
    // `result.current` holds the document that won.
    console.warn("Save rejected — reload before publishing again.", result.current);
    return;
  }

  console.info("Saved at revision", result.revision);
}
// #endregion save

// #region revision
// The value editor.save() sends as baseRevision.
const base = editor.store.getRevision();
// #endregion revision

export { editor, snapshot, base };
