import { describe, expect, it } from "vitest";
import { stylesToCssText } from "../src/styleFields.js";

describe("stylesToCssText", () => {
  it("serializes ordinary and custom properties", () => {
    expect(stylesToCssText({ color: "red", "--brand": "#00f" })).toBe("color: red; --brand: #00f");
  });

  it("drops values that would start new declarations and invalid property names", () => {
    expect(stylesToCssText({ color: "red; position:fixed; inset:0", "x:y": "1", margin: "0" })).toBe("margin: 0");
  });
});
