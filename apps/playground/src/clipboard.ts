import type { SubtreeSnapshot } from "eugine";

/**
 * An in-app clipboard, not the OS clipboard — simpler and more reliable (no
 * permission prompts, works instantly), and standard for editors like this
 * (Figma's Cmd+D doesn't touch the OS clipboard either). Holds
 * SubtreeSnapshot values from editor.copySubtree(), which stay valid to
 * paste from even after further edits or the original being deleted.
 *
 * Shared module-level state (rather than living inside keyboard.ts) so the
 * keyboard shortcuts and the right-click context menu read/write the same
 * clipboard instead of each keeping their own.
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
