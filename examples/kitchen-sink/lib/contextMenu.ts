import type { Editor } from "eugine";
import { copySelection, deleteSelection, duplicateSelection, pasteClipboard } from "./actions";
import { hasClipboard } from "./clipboard";

let menuEl: HTMLElement | null = null;

function closeMenu(): void {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener("pointerdown", onOutsidePointer, true);
  document.removeEventListener("keydown", onMenuKeydown, true);
  window.removeEventListener("scroll", closeMenu, true);
  window.removeEventListener("resize", closeMenu);
}

function onOutsidePointer(event: PointerEvent): void {
  if (menuEl && !menuEl.contains(event.target as Node)) closeMenu();
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") closeMenu();
}

function addItem(menu: HTMLElement, label: string, disabled: boolean, onActivate: () => void): void {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "ks-context-menu-item";
  item.textContent = label;
  item.disabled = disabled;
  item.addEventListener("click", () => {
    closeMenu();
    onActivate();
  });
  menu.appendChild(item);
}

/**
 * Opens a small right-click menu (Copy/Paste/Duplicate/Delete) anchored at
 * (clientX, clientY) and acting on `nodeId` — used identically whether the
 * right-click came from a canvas element or a layers-panel row.
 */
export function showContextMenu(
  editor: Editor,
  nodeId: string,
  clientX: number,
  clientY: number,
  onSelect: (id: string, additive: boolean) => void,
): void {
  closeMenu();

  // Right-clicking an item that's already part of a multi-selection acts on
  // the whole selection; right-clicking anything else selects just that node.
  if (!editor.selection.get().includes(nodeId)) onSelect(nodeId, false);

  const document_ = editor.getDocument();
  const isRoot = nodeId === document_.rootId;
  const selected = editor.selection.get().filter((id) => document_.nodes[id]);
  const mutableSelected = selected.filter((id) => id !== document_.rootId && !document_.nodes[id]?.locked);

  const menu = document.createElement("div");
  menu.className = "ks-context-menu";

  addItem(menu, "Copy", selected.length === 0, () => copySelection(editor, selected));
  addItem(menu, "Paste", !hasClipboard(), () => pasteClipboard(editor, nodeId, onSelect));
  addItem(menu, "Duplicate", mutableSelected.length === 0, () => duplicateSelection(editor, selected, onSelect));
  addItem(menu, "Delete", isRoot || mutableSelected.length === 0, () => deleteSelection(editor, selected));

  document.body.appendChild(menu);
  menuEl = menu;

  const rect = menu.getBoundingClientRect();
  const x = Math.max(4, Math.min(clientX, window.innerWidth - rect.width - 4));
  const y = Math.max(4, Math.min(clientY, window.innerHeight - rect.height - 4));
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  document.addEventListener("pointerdown", onOutsidePointer, true);
  document.addEventListener("keydown", onMenuKeydown, true);
  window.addEventListener("scroll", closeMenu, true);
  window.addEventListener("resize", closeMenu);
}
