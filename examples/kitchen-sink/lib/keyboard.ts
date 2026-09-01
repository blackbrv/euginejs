import type { Editor } from "eugine";
import { copySelection, deleteSelection, duplicateSelection, pasteClipboard } from "./actions";
import { hasClipboard } from "./clipboard";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Wires the normal editor keyboard vocabulary — Delete/Backspace, Cmd/Ctrl+C
 * copy, Cmd/Ctrl+V paste, Cmd/Ctrl+D duplicate, Cmd/Ctrl+Z undo,
 * Cmd/Ctrl+Shift+Z (or +Y) redo, Escape to deselect — onto whatever is
 * currently selected. Mirrors apps/playground/src/keyboard.ts; disabled
 * while typing in a form field or editing a node's text in place on the
 * canvas (both are contentEditable/INPUT targets, so isTypingTarget covers
 * both). Locked nodes are handled by copySelection/deleteSelection/
 * duplicateSelection themselves (lib/actions.ts already filters them out).
 *
 * Returns an unsubscribe function — unlike the playground (a plain SPA
 * mounted exactly once), Studio.tsx is a React effect that can re-run (React
 * Strict Mode double-invokes effects in dev), so the listener must be
 * removable on cleanup or a remount would double-fire every shortcut.
 */
export function initKeyboardShortcuts(editor: Editor, onSelect: (id: string, additive: boolean) => void): () => void {
  const onKeydown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;

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
  };

  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}
