import { createAutosave, type AutosaveHandle, type Editor, type EuginePlugin } from "eugine";

/**
 * A real EuginePlugin: install()/destroy() lifecycle hooks, wired through
 * editor.use(). Demonstrates that "advanced functionality is a plugin, not
 * core bloat" — this exact `createAutosave` helper is what a host would use
 * to wire document changes to their own save function.
 */
export function createAutosavePlugin(onSave: (nodeCount: number) => void, debounceMs = 1500): EuginePlugin<Editor> {
  let autosave: AutosaveHandle | null = null;
  return {
    name: "autosave-log",
    install(editor) {
      autosave = createAutosave(
        editor.store,
        (document) => {
          onSave(Object.keys(document.nodes).length);
        },
        { debounceMs },
      );
    },
    destroy() {
      // stop() flushes any change still waiting on the debounce rather than
      // discarding it — closing the editor a beat after the user's last edit
      // must not be what loses that edit.
      void autosave?.stop();
      autosave = null;
    },
  };
}
