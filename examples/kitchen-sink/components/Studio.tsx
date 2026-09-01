"use client";

import { createEditor, type Editor } from "eugine";
import { useEffect, useRef, useState } from "react";
import { ApiStorageAdapter } from "@/lib/apiStorageAdapter";
import { createAutosavePlugin } from "@/lib/autosavePlugin";
import { mountCanvas, PALETTE_ITEMS, registerPaletteDrag } from "@/lib/canvas";
import { componentIcon } from "@/lib/componentIcons";
import { showContextMenu } from "@/lib/contextMenu";
import { icon } from "@/lib/icons";
import { initKeyboardShortcuts } from "@/lib/keyboard";
import { createPokemonDataPlugin } from "@/lib/pokemonDataPlugin";
import { renderEventLog, renderInspector, renderLayers } from "@/lib/panels";
import { toComponentDefinitions } from "@/lib/schema";
import { initTheme, toggleTheme } from "@/lib/theme";

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
  // Starts "light" to match the server-rendered markup; the layout's inline
  // script (see app/layout.tsx) sets the real data-theme attribute before
  // paint, and this effect below reconciles React's state to it on mount.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showEvents, setShowEvents] = useState(true);

  useEffect(() => {
    setTheme(initTheme());
  }, []);

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

    const pokemonPlugin = createPokemonDataPlugin((line) => log(`[plugin:pokemon] ${line}`));
    editor.use(pokemonPlugin);

    const onSelect = (id: string, additive: boolean) => editor.selection.select(id, { additive });
    const onContextMenu = (id: string, clientX: number, clientY: number) => showContextMenu(editor, id, clientX, clientY, onSelect);
    const canvas = mountCanvas(editor, pokemonPlugin, canvasRef.current!, onSelect, onContextMenu);
    const unbindKeyboard = initKeyboardShortcuts(editor, onSelect);

    // Same timing as the previewStyle closure below: the renderer must exist
    // before the plugin can imperatively patch pokemon nodes on the canvas.
    pokemonPlugin.attachRenderer(canvas.renderer);

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
    paletteRef.current!.className = "ks-palette-grid";
    for (const item of PALETTE_ITEMS) {
      const el = document.createElement("div");
      el.className = "ks-palette-item";
      if (item.description) el.title = item.description;
      const iconEl = document.createElement("span");
      iconEl.className = "ks-palette-icon";
      iconEl.innerHTML = componentIcon(item.type);
      const label = document.createElement("span");
      label.className = "ks-palette-label";
      label.textContent = item.label;
      el.append(iconEl, label);
      registerPaletteDrag(el, item.type);
      el.addEventListener("click", () => onSelect(editor.insert(item.type, editor.getDocument().rootId), false));
      paletteRef.current!.appendChild(el);
    }

    refreshPanels();
    setCanUndo(editor.history.canUndo());
    setCanRedo(editor.history.canRedo());
    log("editor.ready");

    return () => {
      unbindKeyboard();
      canvas.destroy();
      canvas.renderer.destroy();
      editor.destroy();
    };
  }, []);

  const onToggleTheme = () => setTheme(toggleTheme());
  const onToggleEvents = () => setShowEvents((v) => !v);

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

    // editor.save() sends the revision this document was based on, so the
    // server can refuse a write that would overwrite someone else's newer one.
    const result = await editor.save();
    if (!result.ok) {
      setStatus("Someone else published since you started. Load from server, then re-apply your changes.");
      return;
    }
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
          <button
            className="ks-icon-btn"
            onClick={() => editorRef.current?.history.undo()}
            disabled={!canUndo}
            title="Undo"
            aria-label="Undo"
            dangerouslySetInnerHTML={{ __html: icon("undo") }}
          />
          <button
            className="ks-icon-btn"
            onClick={() => editorRef.current?.history.redo()}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo"
            dangerouslySetInnerHTML={{ __html: icon("redo") }}
          />
          <button
            onClick={batchDuplicate}
            dangerouslySetInnerHTML={{ __html: `${icon("copy")}<span>Duplicate ×3 (1 undo)</span>` }}
          />
          <button className="ks-btn-accent" onClick={publish}>
            Publish
          </button>
          <button onClick={loadFromServer}>Load from server</button>
          <a href="/preview" target="_blank" rel="noreferrer">
            Preview
          </a>
          <span className="ks-status">{status}</span>
          <button
            type="button"
            className="ks-toolbar-toggle"
            aria-pressed={showEvents}
            title={showEvents ? "Hide logs" : "Show logs"}
            onClick={onToggleEvents}
            dangerouslySetInnerHTML={{ __html: `${icon("terminal")}<span>Logs</span>` }}
          />
          <button
            type="button"
            className="ks-theme-toggle"
            data-theme-icon={theme}
            title="Toggle theme"
            aria-label="Toggle color theme"
            onClick={onToggleTheme}
          >
            <span className="ks-theme-icon ks-theme-icon-sun" dangerouslySetInnerHTML={{ __html: icon("sun") }} />
            <span className="ks-theme-icon ks-theme-icon-moon" dangerouslySetInnerHTML={{ __html: icon("moon") }} />
          </button>
        </div>
      </header>
      <div className={`ks-body${showEvents ? "" : " ks-body-no-events"}`}>
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
        {/* Kept mounted (just hidden) rather than conditionally rendered, so
            eventLogRef stays attached — log() below runs on every editor
            event regardless of whether this panel is visible, and would
            throw on a null ref if the <aside> unmounted while hidden. */}
        <aside className="ks-panel ks-events" hidden={!showEvents}>
          <h3>Event log</h3>
          <div ref={eventLogRef} />
        </aside>
      </div>
    </div>
  );
}
