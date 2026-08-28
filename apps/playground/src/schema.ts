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
  /** Shown in the palette. Root is not draggable from the palette. */
  paletteVisible: boolean;
}

export const COMPONENT_SCHEMAS: ComponentSchema[] = [
  {
    type: "section",
    label: "Section",
    accepts: "*",
    defaults: { className: "" },
    fields: [{ name: "className", label: "Class name" }],
    paletteVisible: true,
  },
  {
    type: "container",
    label: "Container",
    accepts: "*",
    defaults: { className: "" },
    fields: [{ name: "className", label: "Class name" }],
    paletteVisible: true,
  },
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
    defaults: { content: "Some body text. Double-click to edit in the inspector." },
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
  {
    type: "image",
    label: "Image",
    accepts: "none",
    defaults: { src: "https://placehold.co/320x180", alt: "Placeholder image" },
    fields: [
      { name: "src", label: "Image URL" },
      { name: "alt", label: "Alt text" },
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
