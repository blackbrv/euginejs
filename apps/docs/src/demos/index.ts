import type { ComponentDefinition, Editor } from "eugine";
import type { DomComponentRenderer } from "eugine/renderer";

/**
 * Demo registries are deliberately tiny and purpose-built per concept — three
 * or four component types, no property panels, no drag layer. They are not a
 * copy of apps/playground's schema: a demo that illustrates one idea should
 * not make the reader wade through a full builder to find it.
 */
export interface DemoDefinition {
  /** Editor-side definitions: drop rules and prop defaults. */
  components: ComponentDefinition[];
  /** Renderer-side definitions: how each type becomes DOM. */
  renderers: ComponentDefinition<DomComponentRenderer>[];
  /** Builds the starting document. */
  seed: (editor: Editor) => void;
}

function element(tag: string, className: string): DomComponentRenderer {
  return (props, children) => {
    const el = document.createElement(tag);
    el.className = className;
    const text = props.text;
    if (typeof text === "string") el.textContent = text;
    for (const child of children) el.appendChild(child);
    return el;
  };
}

const stack = element("div", "flex flex-col gap-2 rounded border border-dashed border-fd-border p-3");
const heading = element("h3", "text-lg font-semibold");
const paragraph = element("p", "text-sm text-fd-muted-foreground");

/** The registry used by most concept pages: a container and two leaf types. */
const basics: DemoDefinition = {
  components: [
    { type: "stack", label: "Stack", accepts: "*" },
    { type: "heading", label: "Heading", accepts: "none", defaults: { props: { text: "A heading" } } },
    { type: "paragraph", label: "Paragraph", accepts: "none", defaults: { props: { text: "Some copy." } } },
  ],
  renderers: [
    { type: "root", render: element("div", "flex flex-col gap-3") },
    { type: "stack", render: stack },
    { type: "heading", render: heading },
    { type: "paragraph", render: paragraph },
  ],
  seed: (editor) => {
    const root = editor.getDocument().rootId;
    const section = editor.insert("stack", root);
    editor.insert("heading", section, { props: { text: "Hello from Eugine" } });
    editor.insert("paragraph", section, { props: { text: "Every edit here is a command on a real editor." } });
  },
};

export const DEMOS = {
  basics,
} satisfies Record<string, DemoDefinition>;

export type DemoId = keyof typeof DEMOS;
