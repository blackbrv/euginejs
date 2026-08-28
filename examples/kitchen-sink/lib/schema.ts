import type { ComponentDefinition, DropAcceptRule } from "eugine";

export interface FieldSchema {
  name: string;
  label: string;
}

export interface ComponentSchema {
  type: string;
  label: string;
  accepts: DropAcceptRule;
  maxChildren?: number;
  defaults: Record<string, unknown>;
  fields: FieldSchema[];
  paletteVisible: boolean;
}

export const COMPONENT_SCHEMAS: ComponentSchema[] = [
  { type: "section", label: "Section", accepts: "*", defaults: {}, fields: [], paletteVisible: true },
  { type: "container", label: "Container", accepts: "*", defaults: {}, fields: [], paletteVisible: true },
  {
    type: "grid",
    label: "Grid (max 4 cards)",
    accepts: ["card"],
    maxChildren: 4,
    defaults: {},
    fields: [],
    paletteVisible: true,
  },
  { type: "card", label: "Card", accepts: "*", defaults: { title: "Card" }, fields: [{ name: "title", label: "Title" }], paletteVisible: true },
  {
    type: "heading",
    label: "Heading",
    accepts: "none",
    defaults: { content: "A bold heading" },
    fields: [{ name: "content", label: "Text" }],
    paletteVisible: true,
  },
  {
    type: "text",
    label: "Text",
    accepts: "none",
    defaults: { content: "Body text." },
    fields: [{ name: "content", label: "Text" }],
    paletteVisible: true,
  },
  {
    type: "button",
    label: "Button",
    accepts: "none",
    defaults: { label: "Click me", href: "#" },
    fields: [
      { name: "label", label: "Label" },
      { name: "href", label: "Link (href)" },
    ],
    paletteVisible: true,
  },
];

export function toComponentDefinitions(): ComponentDefinition[] {
  return COMPONENT_SCHEMAS.map((schema) => ({
    type: schema.type,
    label: schema.label,
    accepts: schema.accepts,
    maxChildren: schema.maxChildren,
    defaults: { props: schema.defaults },
  }));
}

export function schemaFor(type: string): ComponentSchema | undefined {
  return COMPONENT_SCHEMAS.find((s) => s.type === type);
}
