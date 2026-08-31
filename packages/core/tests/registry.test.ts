import { describe, expect, it } from "vitest";
import { ComponentRegistry } from "../src/registry.js";
import { EugineError } from "../src/errors.js";

describe("ComponentRegistry", () => {
  it("registers and resolves component definitions", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "hero", defaults: { props: { title: "Hello" } } });
    expect(registry.has("hero")).toBe(true);
    expect(registry.get("hero").defaults?.props?.title).toBe("Hello");
  });

  it("throws EUGINE_COMPONENT_NOT_REGISTERED for unknown types", () => {
    const registry = new ComponentRegistry();
    expect(() => registry.get("missing")).toThrow(EugineError);
    try {
      registry.get("missing");
    } catch (error) {
      expect((error as EugineError).code).toBe("EUGINE_COMPONENT_NOT_REGISTERED");
    }
  });

  it("refuses to register the same type twice", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "hero" });
    expect(() => registry.register({ type: "hero" })).toThrow(EugineError);
    try {
      registry.register({ type: "hero" });
    } catch (error) {
      expect((error as EugineError).code).toBe("EUGINE_COMPONENT_ALREADY_REGISTERED");
    }
  });

  it("enforces accepts: 'none'", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "text", accepts: "none" });
    expect(registry.canAcceptChild({ parentType: "text", childType: "text", currentChildCount: 0 })).toBe(false);
  });

  it("enforces an explicit accepts list", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "grid", accepts: ["card"] });
    expect(registry.canAcceptChild({ parentType: "grid", childType: "card", currentChildCount: 0 })).toBe(true);
    expect(registry.canAcceptChild({ parentType: "grid", childType: "text", currentChildCount: 0 })).toBe(false);
  });

  it("enforces maxChildren", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "grid", accepts: "*", maxChildren: 2 });
    expect(registry.canAcceptChild({ parentType: "grid", childType: "card", currentChildCount: 1 })).toBe(true);
    expect(registry.canAcceptChild({ parentType: "grid", childType: "card", currentChildCount: 2 })).toBe(false);
  });

  it("defaults to accepting anything when `accepts` is omitted", () => {
    const registry = new ComponentRegistry();
    registry.register({ type: "container" });
    expect(registry.canAcceptChild({ parentType: "container", childType: "anything", currentChildCount: 100 })).toBe(
      true,
    );
  });
});
