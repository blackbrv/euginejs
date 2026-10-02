import { describe, expect, it } from "vitest";
import { DESIGN_FIELDS, nextToggleValue } from "../src/styleFields.js";

/** Guards the click math of the design panel's icon toggles, single-choice and `multiple`. */

const field = (property: string) => DESIGN_FIELDS.find((f) => f.property === property)!;

describe("nextToggleValue", () => {
  it("single-choice: picks an option, clicking it again clears to Default", () => {
    const display = field("display");
    expect(nextToggleValue(display, "", "flex")).toBe("flex");
    expect(nextToggleValue(display, "flex", "grid")).toBe("grid");
    expect(nextToggleValue(display, "flex", "flex")).toBe("");
  });

  it("multiple: combines lines in options order and removes them one at a time", () => {
    const decoration = field("text-decoration-line");
    expect(nextToggleValue(decoration, "", "line-through")).toBe("line-through");
    expect(nextToggleValue(decoration, "line-through", "underline")).toBe("underline line-through");
    expect(nextToggleValue(decoration, "underline line-through", "underline")).toBe("line-through");
    expect(nextToggleValue(decoration, "line-through", "line-through")).toBe("");
  });

  it("multiple: none is exclusive both ways, unknown tokens survive", () => {
    const decoration = field("text-decoration-line");
    expect(nextToggleValue(decoration, "underline overline", "none")).toBe("none");
    expect(nextToggleValue(decoration, "none", "none")).toBe("");
    expect(nextToggleValue(decoration, "none", "overline")).toBe("overline");
    expect(nextToggleValue(decoration, "blink", "underline")).toBe("underline blink");
  });
});
