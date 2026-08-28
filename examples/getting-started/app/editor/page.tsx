"use client";

import { createEditor, type Editor } from "eugine";
import { renderToDom, type DomComponentRenderer } from "eugine/renderer";
import { ComponentRegistry } from "eugine";
import { useEffect, useRef, useState } from "react";
import { COMPONENT_DEFINITIONS } from "@/lib/document";

function createDomRegistry(): ComponentRegistry<DomComponentRenderer> {
  const registry = new ComponentRegistry<DomComponentRenderer>();
  registry.register({
    type: "root",
    render: (_props, children) => {
      const el = document.createElement("div");
      children.forEach((c) => el.appendChild(c));
      return el;
    },
  });
  registry.register({
    type: "section",
    render: (_props, children) => {
      const el = document.createElement("section");
      children.forEach((c) => el.appendChild(c));
      return el;
    },
  });
  registry.register({
    type: "heading",
    render: (props) => {
      const el = document.createElement("h1");
      el.textContent = String(props.content ?? "");
      return el;
    },
  });
  registry.register({
    type: "text",
    render: (props) => {
      const el = document.createElement("p");
      el.textContent = String(props.content ?? "");
      return el;
    },
  });
  return registry;
}

/**
 * A Client Component: this is the browser-only half of the app, behind the
 * "use client" boundary Next.js requires for interactive/stateful UI. The
 * editor engine (@eugine/core) has no DOM dependency itself, but mounting
 * the DOM renderer must happen inside useEffect, since it needs a real
 * `document` to build elements into — which doesn't exist during SSR.
 */
export default function EditorPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [json, setJson] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const editor = createEditor({ components: COMPONENT_DEFINITIONS });
    editorRef.current = editor;

    const renderer = renderToDom(editor.getDocument(), canvasRef.current!, { registry: createDomRegistry() });

    const refresh = () => {
      renderer.update(editor.getDocument());
      setJson(JSON.stringify(editor.serialize(), null, 2));
      setCanUndo(editor.history.canUndo());
      setCanRedo(editor.history.canRedo());
    };
    editor.events.on("document.change", refresh);
    refresh();

    return () => {
      renderer.destroy();
      editor.destroy();
    };
  }, []);

  const insert = (type: string) => {
    const editor = editorRef.current!;
    editor.insert(type, editor.getDocument().rootId);
  };

  return (
    <>
      <h2>Interactive editor</h2>
      <p>
        A minimal client-side editor: <code>createEditor()</code> + <code>renderToDom()</code> from{" "}
        <code>eugine/renderer</code>, wired into a React ref.
      </p>
      <div className="eb-toolbar">
        <button onClick={() => insert("section")}>Add section</button>
        <button onClick={() => insert("heading")}>Add heading</button>
        <button onClick={() => insert("text")}>Add text</button>
        <button onClick={() => editorRef.current?.history.undo()} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={() => editorRef.current?.history.redo()} disabled={!canRedo}>
          Redo
        </button>
      </div>
      <div ref={canvasRef} className="eb-canvas" />
      <h3>editor.serialize()</h3>
      <pre>{json}</pre>
    </>
  );
}
