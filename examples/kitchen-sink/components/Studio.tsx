"use client";

import { createEditor, type Editor } from "eugine";
import { useEffect, useRef, useState } from "react";
import { ApiStorageAdapter } from "@/lib/apiStorageAdapter";
import { createAutosavePlugin } from "@/lib/autosavePlugin";
import { mountCanvas, PALETTE_ITEMS, registerPaletteDrag } from "@/lib/canvas";
import { showContextMenu } from "@/lib/contextMenu";
import { renderEventLog, renderInspector, renderLayers } from "@/lib/panels";
import { toComponentDefinitions } from "@/lib/schema";

export default function Studio() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const eventLogRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const editor = createEditor({ components: toComponentDefinitions() });
    editorRef.current = editor;
    editor.storage.use(new ApiStorageAdapter());

    const events: string[] = [];
    const log = (line: string) => {
      events.push(`${new Date().toLocaleTimeString()}  ${line}`);
      renderEventLog(events, eventLogRef.current!);
    };

    editor.use(
      createAutosavePlugin((nodeCount) => log(`[plugin:autosave] ${nodeCount} nodes (logged only, not published)`)),
    );

    const onSelect = (id: string, additive: boolean) => editor.selection.select(id, { additive });
    const onContextMenu = (id: string, clientX: number, clientY: number) => showContextMenu(editor, id, clientX, clientY, onSelect);
    const canvas = mountCanvas(editor, canvasRef.current!, onSelect, onContextMenu);

    const previewStyle = (id: string, property: string, value: string) => {
      const el = canvas.renderer.getElement(id);
      if (el instanceof HTMLElement) el.style.setProperty(property, value);
    };

    const refreshPanels = () => {
      renderLayers(editor, layersRef.current!, onSelect, onContextMenu);
      renderInspector(editor, inspectorRef.current!, previewStyle);
    };

    editor.events.on("document.change", () => {
      canvas.refresh();
      refreshPanels();
      setCanUndo(editor.history.canUndo());
      setCanRedo(editor.history.canRedo());
    });
    editor.selection.onSelectionChange(() => refreshPanels());

    editor.events.on("node.create", (p) => log(`node.create ${p.node.type}`));
    editor.events.on("node.delete", (p) => log(`node.delete ${p.id}`));
    editor.events.on("node.move", (p) => log(`node.move ${p.id} -> ${p.parentId}`));
    editor.events.on("history.undo", () => log("history.undo"));
    editor.events.on("history.redo", () => log("history.redo"));
    editor.events.on("document.load", () => log("document.load"));

    // Cleared defensively: React Strict Mode runs effects twice in dev
    // (mount -> cleanup -> mount), and unlike the canvas/layers/inspector
    // panels (which fully rebuild their contents on every refresh), this
    // palette is built exactly once per effect run.
    paletteRef.current!.innerHTML = "";
    for (const item of PALETTE_ITEMS) {
      const el = document.createElement("div");
      el.className = "ks-palette-item";
      el.textContent = item.label;
      registerPaletteDrag(el, item.type);
      el.addEventListener("click", () => onSelect(editor.insert(item.type, editor.getDocument().rootId), false));
      paletteRef.current!.appendChild(el);
    }

    refreshPanels();
    setCanUndo(editor.history.canUndo());
    setCanRedo(editor.history.canRedo());
    log("editor.ready");

    return () => {
      canvas.destroy();
      canvas.renderer.destroy();
      editor.destroy();
    };
  }, []);

  const batchDuplicate = () => {
    const editor = editorRef.current!;
    const id = editor.selection.get()[0];
    if (!id) return;
    // Three duplicate() calls, but ONE undo step — this is editor.transaction().
    editor.transaction(() => {
      editor.duplicate(id);
      editor.duplicate(id);
      editor.duplicate(id);
    }, "duplicate x3");
  };

  const publish = async () => {
    const editor = editorRef.current!;
    setStatus("Publishing…");
    await editor.storage.save(editor.serialize());
    setStatus("Published. See /preview.");
  };

  const loadFromServer = async () => {
    const editor = editorRef.current!;
    setStatus("Loading…");
    const saved = await editor.storage.load();
    if (!saved) {
      setStatus("Nothing published yet.");
      return;
    }
    editor.load(saved);
    setStatus("Loaded from server.");
  };

  return (
    <div className="ks-app">
      <header className="ks-toolbar">
        <strong>Eugine Kitchen Sink</strong>
        <div className="ks-toolbar-actions">
          <button onClick={() => editorRef.current?.history.undo()} disabled={!canUndo}>
            Undo
          </button>
          <button onClick={() => editorRef.current?.history.redo()} disabled={!canRedo}>
            Redo
          </button>
          <button onClick={batchDuplicate}>Duplicate ×3 (1 undo)</button>
          <button onClick={publish}>Publish</button>
          <button onClick={loadFromServer}>Load from server</button>
          <a href="/preview" target="_blank" rel="noreferrer">
            View /preview
          </a>
          <span className="ks-status">{status}</span>
        </div>
      </header>
      <div className="ks-body">
        <aside className="ks-panel ks-palette">
          <h3>Components</h3>
          <div ref={paletteRef} />
          <h3>Layers</h3>
          <div ref={layersRef} />
        </aside>
        <main className="ks-canvas-wrapper">
          <div ref={canvasRef} className="ks-canvas" />
        </main>
        <aside className="ks-panel ks-inspector" ref={inspectorRef} />
        <aside className="ks-panel ks-events">
          <h3>Event log</h3>
          <div ref={eventLogRef} />
        </aside>
      </div>
    </div>
  );
}
