import { createEditor } from "eugine";
import { mountCanvas, registerPaletteDrag, PALETTE_ITEMS } from "./canvas.js";
import { componentIcon } from "./componentIcons.js";
import { showContextMenu } from "./contextMenu.js";
import { openExportDialog } from "./exportDialog.js";
import { icon } from "./icons.js";
import { initKeyboardShortcuts } from "./keyboard.js";
import { renderInspector, renderLayers } from "./panels.js";
import { toComponentDefinitions } from "./schema.js";
import { LocalStorageAdapter } from "./storageAdapter.js";
import { showToast } from "./toast.js";
import { getTheme, initTheme, toggleTheme } from "./theme.js";

initTheme();

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="eb-app">
    <header class="eb-toolbar">
      <div class="eb-brand">
        <span class="eb-brand-mark">E</span>
        <strong>Eugine Playground</strong>
      </div>
      <div class="eb-toolbar-actions">
        <div class="eb-btn-group" role="group" aria-label="History">
          <button id="btn-undo" class="eb-btn eb-btn-icon" title="Undo" aria-label="Undo">${icon("undo")}</button>
          <button id="btn-redo" class="eb-btn eb-btn-icon" title="Redo" aria-label="Redo">${icon("redo")}</button>
        </div>
        <div class="eb-btn-group" role="group" aria-label="Storage">
          <button id="btn-save" class="eb-btn" title="Save to local storage">${icon("save")}<span>Save</span></button>
          <button id="btn-load" class="eb-btn" title="Load from local storage">${icon("folder")}<span>Load</span></button>
        </div>
        <button id="btn-export" class="eb-btn eb-btn-accent" title="Export site">${icon("code")}<span>Export</span></button>
        <button id="btn-theme" class="eb-btn eb-btn-icon eb-theme-toggle" title="Toggle theme" aria-label="Toggle color theme">
          <span class="eb-theme-icon eb-theme-icon-sun">${icon("sun")}</span>
          <span class="eb-theme-icon eb-theme-icon-moon">${icon("moon")}</span>
        </button>
      </div>
    </header>
    <div class="eb-body">
      <aside class="eb-panel eb-palette">
        <h3>Components</h3>
        <div id="palette-list"></div>
        <h3>Layers</h3>
        <div id="layers-list"></div>
      </aside>
      <main class="eb-canvas-wrapper">
        <div id="canvas" class="eb-canvas"></div>
      </main>
      <aside class="eb-panel eb-inspector" id="inspector"></aside>
    </div>
  </div>
`;

const editor = createEditor({ components: toComponentDefinitions() });
editor.storage.use(new LocalStorageAdapter());

const canvasEl = document.getElementById("canvas") as HTMLElement;
const layersEl = document.getElementById("layers-list") as HTMLElement;
const inspectorEl = document.getElementById("inspector") as HTMLElement;
const paletteEl = document.getElementById("palette-list") as HTMLElement;

function selectNode(id: string, additive = false): void {
  editor.selection.select(id, { additive });
}

function onContextMenu(id: string, clientX: number, clientY: number): void {
  showContextMenu(editor, id, clientX, clientY, selectNode);
}

const canvas = mountCanvas(editor, canvasEl, selectNode, onContextMenu);
initKeyboardShortcuts(editor, selectNode);

function previewStyle(id: string, property: string, value: string): void {
  const el = canvas.renderer.getElement(id);
  if (el instanceof HTMLElement) el.style.setProperty(property, value);
}

function refreshPanels(): void {
  renderLayers(editor, layersEl, selectNode, onContextMenu);
  renderInspector(editor, inspectorEl, previewStyle);
}

editor.events.on("document.change", () => {
  canvas.refresh();
  refreshPanels();
  updateHistoryButtons();
});
editor.selection.onSelectionChange(({ ids }) => {
  refreshPanels();
  canvas.renderer.setSelection(ids);
  const lastSelected = ids.at(-1);
  const el = lastSelected ? canvas.renderer.getElement(lastSelected) : undefined;
  if (el instanceof Element) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
});

for (const item of PALETTE_ITEMS) {
  const el = document.createElement("div");
  el.className = "eb-palette-item";
  el.innerHTML = `${componentIcon(item.type)}<span>${item.label}</span>`;
  registerPaletteDrag(el, item.type);
  el.addEventListener("click", () => selectNode(editor.insert(item.type, editor.getDocument().rootId)));
  paletteEl.appendChild(el);
}

const undoBtn = document.getElementById("btn-undo") as HTMLButtonElement;
const redoBtn = document.getElementById("btn-redo") as HTMLButtonElement;

function updateHistoryButtons(): void {
  undoBtn.disabled = !editor.history.canUndo();
  redoBtn.disabled = !editor.history.canRedo();
}

undoBtn.addEventListener("click", () => editor.history.undo());
redoBtn.addEventListener("click", () => editor.history.redo());

document.getElementById("btn-save")!.addEventListener("click", async () => {
  // editor.save() tags the write with the revision it was based on, so a
  // second tab that saved in the meantime is reported instead of overwritten.
  const result = await editor.save();
  if (!result.ok) {
    showToast("Someone else saved this page first — reload before saving again", "error");
    return;
  }
  showToast("Saved to local storage", "success");
});

document.getElementById("btn-load")!.addEventListener("click", async () => {
  const saved = await editor.storage.load();
  if (!saved) {
    showToast("Nothing saved yet", "error");
    return;
  }
  editor.load(saved);
  showToast("Loaded from local storage", "success");
});

document.getElementById("btn-export")!.addEventListener("click", () => {
  openExportDialog(editor.getDocument());
});

const themeBtn = document.getElementById("btn-theme") as HTMLButtonElement;
themeBtn.setAttribute("data-theme-icon", getTheme());
themeBtn.addEventListener("click", () => {
  const next = toggleTheme();
  themeBtn.setAttribute("data-theme-icon", next);
});

refreshPanels();
updateHistoryButtons();

// Exposed for manual/automated smoke-testing in a real browser.
(window as unknown as { __eugine: unknown }).__eugine = { editor };
