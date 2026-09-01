import type { DiagramDefinition } from "./types";

export type NodeId =
  | "document"
  | "domRegistry"
  | "htmlRegistry"
  | "renderToDom"
  | "renderToString"
  | "node"
  | "htmlString";

export const rendererSplitDiagram: DiagramDefinition<NodeId> = {
  nodes: [
    {
      id: "document",
      label: "EugineDocument",
      description:
        "One plain, JSON-serializable document feeds both renderers. It never contains editor-only state.",
      x: 0,
      y: 0,
      kind: "start",
    },
    {
      id: "domRegistry",
      label: "ComponentRegistry<DomComponentRenderer>",
      description:
        "A registry built for the DOM contract — each renderer returns a Node. The same document's component definitions are not usable here.",
      x: -300,
      y: 200,
    },
    {
      id: "htmlRegistry",
      label: "ComponentRegistry<HtmlComponentRenderer>",
      description:
        "A separate registry built for the HTML contract — each renderer returns a string. Built independently of the DOM registry.",
      x: 300,
      y: 200,
    },
    {
      id: "renderToDom",
      label: "renderToDom()",
      description:
        "Mounts the document into a browser container, reconciling incrementally by reference equality on update().",
      x: -300,
      y: 360,
    },
    {
      id: "renderToString",
      label: "renderToString()",
      description:
        "Renders to a string with no browser APIs. The renderer-server package excludes the DOM lib at compile time.",
      x: 300,
      y: 360,
    },
    {
      id: "node",
      label: "Node (browser DOM)",
      description:
        "A real DOM Node for use inside the editor canvas.",
      x: -300,
      y: 520,
      kind: "end",
    },
    {
      id: "htmlString",
      label: "string (HTML)",
      description:
        "Deterministic HTML for SSR, safe on a server with no window or document.",
      x: 300,
      y: 520,
      kind: "end",
    },
  ],
  edges: [
    { id: "document-domRegistry", from: "document", to: "domRegistry" },
    { id: "document-htmlRegistry", from: "document", to: "htmlRegistry" },
    { id: "domRegistry-renderToDom", from: "domRegistry", to: "renderToDom" },
    { id: "htmlRegistry-renderToString", from: "htmlRegistry", to: "renderToString" },
    { id: "renderToDom-node", from: "renderToDom", to: "node" },
    { id: "renderToString-htmlString", from: "renderToString", to: "htmlString" },
  ],
};
