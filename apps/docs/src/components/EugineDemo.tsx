"use client";

import { useEffect, useRef, useState } from "react";
import { ComponentRegistry, createEditor, type Editor } from "eugine";
import { renderToDom, type DomComponentRenderer } from "eugine/renderer";
import { DEMOS, type DemoId } from "@/demos";

export interface EugineDemoProps {
  demo: DemoId;
  /** Toolbar buttons to expose. Defaults to undo/redo/reset. */
  actions?: boolean;
}

/**
 * Mounts a real Eugine editor into the page.
 *
 * `renderToDom()` returns a plain DOM `Node`, not React — so React's job here
 * is only to own a container element and the editor's lifetime. This is the
 * same integration pattern documented under Guides → React; there is no React
 * renderer to reach for, and none is needed.
 */
export function EugineDemo({ demo, actions = true }: EugineDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const definition = DEMOS[demo];
    const editor = createEditor({ components: definition.components });
    editorRef.current = editor;

    // A renderer needs its own registry: DomComponentRenderer returns a Node,
    // which is a different contract from the server renderer's string.
    const registry = new ComponentRegistry<DomComponentRenderer>();
    for (const component of definition.renderers) registry.registerOrReplace(component);

    definition.seed(editor);

    const renderer = renderToDom(editor.getDocument(), container, { registry });
    const offChange = editor.events.on("document.change", ({ document }) => {
      renderer.update(document);
      forceRender((n) => n + 1);
    });
    // setSelection toggles data-eugine-selected on the live elements without a
    // reconcile, so focus and scroll survive a selection change.
    const offSelect = editor.selection.onSelectionChange(({ ids }) => renderer.setSelection(ids));

    setReady(true);

    return () => {
      offChange();
      offSelect();
      renderer.destroy();
      editor.destroy();
      editorRef.current = null;
    };
  }, [demo]);

  const editor = editorRef.current;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-fd-border">
      {actions ? (
        <div className="flex items-center gap-2 border-b border-fd-border bg-fd-muted/40 px-3 py-2">
          <DemoButton onClick={() => editor?.history.undo()} disabled={!ready || !editor?.history.canUndo()}>
            Undo
          </DemoButton>
          <DemoButton onClick={() => editor?.history.redo()} disabled={!ready || !editor?.history.canRedo()}>
            Redo
          </DemoButton>
          <span className="ml-auto font-mono text-xs text-fd-muted-foreground">
            {ready && editor ? `${Object.keys(editor.getDocument().nodes).length} nodes` : "loading…"}
          </span>
        </div>
      ) : null}
      <div ref={containerRef} className="eugine-demo-canvas min-h-32 p-4" />
    </div>
  );
}

function DemoButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-fd-border px-2 py-1 text-xs font-medium transition-colors hover:bg-fd-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
