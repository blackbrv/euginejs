import { describe, expect, it } from "vitest";
import { getDropPosition } from "../src/dragDrop.js";

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("getDropPosition", () => {
  it("classifies the top quarter as before, bottom quarter as after, middle half as inside (default insideRatio)", () => {
    const box = rect(100, 0, 100, 100); // vertical span 100..200

    expect(getDropPosition(box, { clientX: 0, clientY: 105 })).toBe("before");
    expect(getDropPosition(box, { clientX: 0, clientY: 124 })).toBe("before");
    expect(getDropPosition(box, { clientX: 0, clientY: 150 })).toBe("inside");
    expect(getDropPosition(box, { clientX: 0, clientY: 176 })).toBe("after");
    expect(getDropPosition(box, { clientX: 0, clientY: 195 })).toBe("after");
  });

  it("with insideRatio 0, splits exactly down the middle between before/after (no inside zone)", () => {
    const box = rect(0, 0, 100, 100);
    expect(getDropPosition(box, { clientX: 0, clientY: 10 }, { insideRatio: 0 })).toBe("before");
    expect(getDropPosition(box, { clientX: 0, clientY: 49 }, { insideRatio: 0 })).toBe("before");
    expect(getDropPosition(box, { clientX: 0, clientY: 51 }, { insideRatio: 0 })).toBe("after");
    expect(getDropPosition(box, { clientX: 0, clientY: 90 }, { insideRatio: 0 })).toBe("after");
  });

  it("with insideRatio 0, never returns 'inside' even at the exact midpoint", () => {
    const box = rect(0, 0, 100, 100);
    expect(getDropPosition(box, { clientX: 0, clientY: 50 }, { insideRatio: 0 })).not.toBe("inside");
  });

  it("measures along the horizontal axis when axis: 'horizontal'", () => {
    const box = rect(0, 100, 100, 40); // horizontal span 100..200
    expect(getDropPosition(box, { clientX: 105, clientY: 999 }, { axis: "horizontal" })).toBe("before");
    expect(getDropPosition(box, { clientX: 150, clientY: 999 }, { axis: "horizontal" })).toBe("inside");
    expect(getDropPosition(box, { clientX: 195, clientY: 999 }, { axis: "horizontal" })).toBe("after");
  });

  it("is pure — the same rect and pointer always produce the same result", () => {
    const box = rect(0, 0, 50, 50);
    const pointer = { clientX: 10, clientY: 10 };
    expect(getDropPosition(box, pointer)).toBe(getDropPosition(box, pointer));
  });
});
