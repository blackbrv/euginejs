import type { Editor } from "eugine";
import { resolveDropParent } from "./canvas";
import { getClipboard, setClipboard } from "./clipboard";

/**
 * The shared copy/paste/duplicate/delete behavior, used by the right-click
 * context menu (contextMenu.ts). Duplicate/delete skip locked nodes — this
 * app's "Lock" toggle (see panels.ts) means "cannot be moved or deleted".
 */

export function copySelection(editor: Editor, ids: string[]): void {
  if (ids.length === 0) return;
  setClipboard(ids.map((id) => editor.copySubtree(id)));
}

export function pasteClipboard(editor: Editor, anchorId: string, onSelect: (id: string, additive: boolean) => void): void {
  const clipboard = getClipboard();
  if (clipboard.length === 0) return;
  const pastedIds: string[] = [];
  editor.transaction(() => {
    for (const snapshot of clipboard) {
      const rootType = snapshot.nodes[snapshot.rootId]?.type;
      if (!rootType) continue;
      const parentId = resolveDropParent(editor, anchorId, rootType);
      pastedIds.push(editor.pasteSubtree(snapshot, parentId));
    }
  }, "paste");
  const lastPasted = pastedIds.at(-1);
  if (lastPasted) onSelect(lastPasted, false);
}

export function duplicateSelection(editor: Editor, ids: string[], onSelect: (id: string, additive: boolean) => void): void {
  const document_ = editor.getDocument();
  const targets = ids.filter((id) => id !== document_.rootId && !document_.nodes[id]?.locked);
  if (targets.length === 0) return;
  let lastId = "";
  editor.transaction(() => {
    for (const id of targets) lastId = editor.duplicate(id);
  }, "duplicate");
  if (lastId) onSelect(lastId, false);
}

export function deleteSelection(editor: Editor, ids: string[]): void {
  const document_ = editor.getDocument();
  const targets = ids.filter((id) => id !== document_.rootId && !document_.nodes[id]?.locked);
  if (targets.length === 0) return;
  editor.transaction(() => {
    for (const id of targets) {
      if (editor.getDocument().nodes[id]) editor.remove(id);
    }
  });
}
