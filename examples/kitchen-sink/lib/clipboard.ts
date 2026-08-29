import type { SubtreeSnapshot } from "eugine";

/**
 * An in-app clipboard, not the OS clipboard — simpler and more reliable (no
 * permission prompts, works instantly), and standard for editors like this
 * (Figma's Cmd+D doesn't touch the OS clipboard either). Holds
 * SubtreeSnapshot values from editor.copySubtree(), which stay valid to
 * paste from even after further edits or the original being deleted.
 *
 * Shared module-level state so every entry point that can copy/paste (right
 * now: the context menu) reads/writes the same clipboard.
 */
let clipboard: SubtreeSnapshot[] = [];

export function getClipboard(): SubtreeSnapshot[] {
  return clipboard;
}

export function setClipboard(snapshots: SubtreeSnapshot[]): void {
  clipboard = snapshots;
}

export function hasClipboard(): boolean {
  return clipboard.length > 0;
}
