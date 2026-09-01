import type { NodeStyles } from "eugine";

export type DesignControl = "color" | "text" | "select" | "length";

export interface DesignFieldDependency {
  property: string;
  value: string | string[];
}

/** Units offered by a "length" control when a field doesn't specify its own. */
export const DEFAULT_LENGTH_UNITS = ["px", "rem", "em", "%"];

export interface DesignFieldDef {
  /** A real CSS property name (kebab-case), applied via CSSStyleDeclaration.setProperty(). */
  property: string;
  label: string;
  group: "Layout" | "Background" | "Typography" | "Border" | "Spacing" | "Effects" | "Animation";
  control: DesignControl;
  options?: string[];
  placeholder?: string;
  /** Units offered for a "length" control's unit dropdown. Defaults to DEFAULT_LENGTH_UNITS. */
  units?: string[];
  /** Only shown once `dependsOn.property`'s current value is one of `dependsOn.value` — e.g. flex options only once display:flex is chosen. */
  dependsOn?: DesignFieldDependency;
}

/** Splits a CSS length like "16px" into its numeric amount and unit. Returns null for anything that isn't a single plain number + unit (multi-value shorthand, keywords, empty). */
export function parseLength(value: string): { amount: string; unit: string } | null {
  const match = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(value.trim());
  if (!match) return null;
  return { amount: match[1]!, unit: match[2]! };
}

/**
 * The curated set of common design controls shown with dedicated UI. Any
 * OTHER CSS property the user adds (via the inspector's "Custom CSS" rows)
 * still works — it's just edited as a raw property/value pair instead of a
 * purpose-built control. Together these two paths cover "everything CSS
 * supports" without needing a bespoke control for every possible property.
 */
export const DESIGN_FIELDS: DesignFieldDef[] = [
  // Layout is only shown for components that can contain children — see
  // isLayoutCapable() below — since flex/grid only affect how *children*
  // are arranged.
  {
    property: "display",
    label: "Display",
    group: "Layout",
    control: "select",
    options: ["block", "flex", "grid", "inline-block", "none"],
  },
  {
    property: "flex-direction",
    label: "Direction",
    group: "Layout",
    control: "select",
    options: ["row", "column", "row-reverse", "column-reverse"],
    dependsOn: { property: "display", value: ["flex", "inline-flex"] },
  },
  {
    property: "justify-content",
    label: "Justify",
    group: "Layout",
    control: "select",
    options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
    dependsOn: { property: "display", value: ["flex", "inline-flex", "grid", "inline-grid"] },
  },
  {
    property: "align-items",
    label: "Align",
    group: "Layout",
    control: "select",
    options: ["stretch", "flex-start", "center", "flex-end", "baseline"],
    dependsOn: { property: "display", value: ["flex", "inline-flex", "grid", "inline-grid"] },
  },
  {
    property: "gap",
    label: "Gap",
    group: "Layout",
    control: "length",
    dependsOn: { property: "display", value: ["flex", "inline-flex", "grid", "inline-grid"] },
  },
  {
    property: "grid-template-columns",
    label: "Columns",
    group: "Layout",
    control: "text",
    placeholder: "1fr 1fr 1fr",
    dependsOn: { property: "display", value: ["grid", "inline-grid"] },
  },
  { property: "background-color", label: "Background", group: "Background", control: "color" },
  { property: "color", label: "Text color", group: "Typography", control: "color" },
  { property: "font-size", label: "Font size", group: "Typography", control: "length" },
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
  { property: "border-width", label: "Width", group: "Border", control: "length", units: ["px", "rem", "em"] },
  {
    property: "border-style",
    label: "Style",
    group: "Border",
    control: "select",
    options: ["none", "solid", "dashed", "dotted"],
  },
  { property: "border-color", label: "Color", group: "Border", control: "color" },
  { property: "border-radius", label: "Radius", group: "Border", control: "length" },
  // A single amount+unit, applied to all four sides. For per-side control
  // (e.g. only padding-left), use the Custom CSS rows below with the
  // longhand property name — those aren't shadowed by this field.
  { property: "padding", label: "Padding", group: "Spacing", control: "length" },
  { property: "margin", label: "Margin", group: "Spacing", control: "length" },
  { property: "opacity", label: "Opacity", group: "Effects", control: "text", placeholder: "1" },
  { property: "box-shadow", label: "Shadow", group: "Effects", control: "text", placeholder: "0 4px 12px rgba(0,0,0,.15)" },
  { property: "filter", label: "Filter", group: "Effects", control: "text", placeholder: "blur(2px)" },
  { property: "cursor", label: "Cursor", group: "Effects", control: "select", options: ["default", "pointer", "grab", "not-allowed", "text"] },
  { property: "transform", label: "Transform", group: "Animation", control: "text", placeholder: "scale(1.05)" },
  { property: "transition", label: "Transition", group: "Animation", control: "text", placeholder: "all 0.2s ease" },
  { property: "animation", label: "Animation", group: "Animation", control: "text", placeholder: "fade-in 0.4s ease-in-out" },
];

export const DESIGN_GROUPS = ["Layout", "Background", "Typography", "Border", "Spacing", "Effects", "Animation"] as const;

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
