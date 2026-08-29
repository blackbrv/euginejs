export type DropPosition = "before" | "after" | "inside";

export type Axis = "vertical" | "horizontal";

export interface GetDropPositionOptions {
  /**
   * Fraction (0–1) of the element's size, centered, that counts as
   * "inside" rather than "before"/"after". Defaults to 0.5 (the middle
   * half is "inside", the outer quarter on each side is "before"/"after").
   * Pass 0 for elements that can't accept children — every point is then
   * either "before" or "after", split down the middle.
   */
  insideRatio?: number;
  /**
   * Which axis to measure along. Use "horizontal" for a row-direction flex
   * container's children, "vertical" (the default) for anything that
   * stacks top-to-bottom (block layout, a column-direction flex container,
   * etc).
   */
  axis?: Axis;
}

/**
 * Classifies where a pointer is over `rect` for drag-and-drop reordering
 * purposes: is the user hovering the leading edge (before), the trailing
 * edge (after), or the middle (inside)? Pure geometry — no DOM/document
 * dependency — so it works the same whether you feed it a live
 * `element.getBoundingClientRect()` during a real drag or a rect from a
 * test. Pair with a drop-indicator element positioned at the returned
 * edge (or spanning `rect` for "inside") for the visual affordance most
 * page builders show while dragging.
 */
export function getDropPosition(
  rect: DOMRect,
  pointer: { clientX: number; clientY: number },
  options: GetDropPositionOptions = {},
): DropPosition {
  const insideRatio = options.insideRatio ?? 0.5;
  const axis = options.axis ?? "vertical";

  const size = axis === "vertical" ? rect.height : rect.width;
  const start = axis === "vertical" ? rect.top : rect.left;
  const point = axis === "vertical" ? pointer.clientY : pointer.clientX;

  if (size <= 0) return "after";
  const fraction = (point - start) / size;

  // insideRatio 0 means "no inside zone at all" — guarantee that even at the
  // exact midpoint (where the two comparisons below would otherwise both be
  // false and fall through to "inside").
  if (insideRatio <= 0) return fraction < 0.5 ? "before" : "after";

  const edge = (1 - insideRatio) / 2;
  if (fraction < edge) return "before";
  if (fraction > 1 - edge) return "after";
  return "inside";
}
