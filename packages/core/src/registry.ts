import { componentNotRegistered, invalidDrop } from "./errors.js";
import type { ComponentDefinition } from "./types.js";

export interface DropCheckContext {
  parentType: string;
  childType: string;
  /** Number of children the parent currently has, before the drop. */
  currentChildCount: number;
}

/**
 * The component registry is the security + capability boundary of Eugine:
 * renderers and the editor resolve a node's `type` string against
 * registered definitions rather than importing/executing anything named
 * inside a (potentially untrusted) document.
 */
export class ComponentRegistry<TRender = unknown> {
  private definitions = new Map<string, ComponentDefinition<TRender>>();

  register(definition: ComponentDefinition<TRender>): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Component type "${definition.type}" is already registered.`);
    }
    this.definitions.set(definition.type, definition);
  }

  /** Registers, replacing any existing definition for the same type. */
  registerOrReplace(definition: ComponentDefinition<TRender>): void {
    this.definitions.set(definition.type, definition);
  }

  unregister(type: string): void {
    this.definitions.delete(type);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  get(type: string): ComponentDefinition<TRender> {
    const definition = this.definitions.get(type);
    if (!definition) throw componentNotRegistered(type);
    return definition;
  }

  tryGet(type: string): ComponentDefinition<TRender> | undefined {
    return this.definitions.get(type);
  }

  list(): ComponentDefinition<TRender>[] {
    return Array.from(this.definitions.values());
  }

  /** Throws EUGINE_INVALID_DROP if `childType` may not be placed inside `parentType`. */
  assertCanAcceptChild(context: DropCheckContext): void {
    const parent = this.get(context.parentType);
    const accepts = parent.accepts ?? "*";

    if (accepts === "none") {
      throw invalidDrop(`Component "${context.parentType}" does not accept any children.`, context);
    }
    if (Array.isArray(accepts) && !accepts.includes(context.childType)) {
      throw invalidDrop(
        `Component "${context.parentType}" does not accept children of type "${context.childType}".`,
        context,
      );
    }
    if (typeof parent.maxChildren === "number" && context.currentChildCount >= parent.maxChildren) {
      throw invalidDrop(
        `Component "${context.parentType}" already has the maximum of ${parent.maxChildren} children.`,
        context,
      );
    }
  }

  canAcceptChild(context: DropCheckContext): boolean {
    try {
      this.assertCanAcceptChild(context);
      return true;
    } catch {
      return false;
    }
  }
}
