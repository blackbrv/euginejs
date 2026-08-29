import type { NodeStyles } from "eugine";

export type DesignControl = "color" | "text" | "select";

export interface DesignFieldDef {
  /** A real CSS property name (kebab-case), applied via CSSStyleDeclaration.setProperty(). */
  property: string;
  label: string;
  group: "Background" | "Typography" | "Border" | "Spacing";
  control: DesignControl;
  options?: string[];
  placeholder?: string;
}

/**
 * The curated set of common design controls shown with dedicated UI. Any
 * OTHER CSS property the user adds (via the inspector's "Custom CSS" rows)
 * still works — it's just edited as a raw property/value pair instead of a
 * purpose-built control. Together these two paths cover "everything CSS
 * supports" without needing a bespoke control for every possible property.
 */
export const DESIGN_FIELDS: DesignFieldDef[] = [
  { property: "background-color", label: "Background", group: "Background", control: "color" },
  { property: "color", label: "Text color", group: "Typography", control: "color" },
  { property: "font-size", label: "Font size", group: "Typography", control: "text", placeholder: "16px" },
  {
    property: "font-weight",
    label: "Font weight",
    group: "Typography",
    control: "select",
    options: ["400", "500", "600", "700"],
  },
  {
    property: "text-align",
    label: "Text align",
    group: "Typography",
    control: "select",
    options: ["left", "center", "right", "justify"],
  },
  { property: "border-width", label: "Width", group: "Border", control: "text", placeholder: "1px" },
  {
    property: "border-style",
    label: "Style",
    group: "Border",
    control: "select",
    options: ["none", "solid", "dashed", "dotted"],
  },
  { property: "border-color", label: "Color", group: "Border", control: "color" },
  { property: "border-radius", label: "Radius", group: "Border", control: "text", placeholder: "8px" },
  { property: "padding", label: "Padding", group: "Spacing", control: "text", placeholder: "12px" },
  { property: "margin", label: "Margin", group: "Spacing", control: "text", placeholder: "0px" },
];

export const DESIGN_GROUPS = ["Background", "Typography", "Border", "Spacing"] as const;

const DESIGN_PROPERTY_SET = new Set(DESIGN_FIELDS.map((f) => f.property));

/** True for any style property NOT covered by a dedicated DESIGN_FIELDS control. */
export function isCustomStyleProperty(property: string): boolean {
  return !DESIGN_PROPERTY_SET.has(property);
}

/**
 * Applies node.styles to a live DOM element via `setProperty()` — never an
 * indexed/`any` write onto CSSStyleDeclaration, so any string the user types
 * as a property name (background-color, box-shadow, transform, anything) is
 * applied exactly as real CSS would interpret it.
 */
export function applyNodeStyles(el: HTMLElement, styles: NodeStyles | undefined): void {
  if (!styles) return;
  for (const [property, value] of Object.entries(styles)) {
    if (value === undefined || value === null || value === "") continue;
    el.style.setProperty(property, String(value));
  }
}

/** Serializes node.styles into a `property: value; ...` string for an HTML `style` attribute. */
export function stylesToCssText(styles: NodeStyles | undefined): string {
  if (!styles) return "";
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([property, value]) => `${property}: ${String(value)}`)
    .join("; ");
}
