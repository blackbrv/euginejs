import type { Editor } from "eugine";
import { copySelection, deleteSelection, duplicateSelection, pasteClipboard } from "./actions.js";
import { hasClipboard } from "./clipboard.js";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function isDialogOpen(): boolean {
  return document.querySelector(".eb-dialog-backdrop.eb-dialog-open") !== null;
}

/**
 * Wires the normal editor keyboard vocabulary — Delete/Backspace, Cmd/Ctrl+C
 * copy, Cmd/Ctrl+V paste, Cmd/Ctrl+D duplicate, Cmd/Ctrl+Z undo,
 * Cmd/Ctrl+Shift+Z (or +Y) redo, Escape to deselect — onto whatever is
 * currently selected. Disabled while typing in a form field or while the
 * export dialog is open (which has its own Escape/Tab handling).
 */
export function initKeyboardShortcuts(editor: Editor, onSelect: (id: string, additive: boolean) => void): void {
  document.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target) || isDialogOpen()) return;

    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const selected = editor.selection.get().filter((id) => editor.getDocument().nodes[id]);

    if ((event.key === "Delete" || event.key === "Backspace") && selected.length > 0) {
      event.preventDefault();
      deleteSelection(editor, selected);
      return;
    }

    if (mod && key === "c" && selected.length > 0) {
      event.preventDefault();
      copySelection(editor, selected);
      return;
    }

    if (mod && key === "v" && hasClipboard()) {
      event.preventDefault();
      const anchorId = selected[0] ?? editor.getDocument().rootId;
      pasteClipboard(editor, anchorId, onSelect);
      return;
    }

    if (mod && key === "d" && selected.length > 0) {
      event.preventDefault();
      duplicateSelection(editor, selected, onSelect);
      return;
    }

    if (mod && !event.shiftKey && key === "z") {
      event.preventDefault();
      editor.history.undo();
      return;
    }

    if (mod && (key === "y" || (event.shiftKey && key === "z"))) {
      event.preventDefault();
      editor.history.redo();
      return;
    }

    if (event.key === "Escape" && selected.length > 0) {
      editor.selection.clear();
    }
  });
}
