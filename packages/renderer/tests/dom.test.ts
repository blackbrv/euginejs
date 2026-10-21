import { ComponentRegistry, createEmptyDocument, createNode, insertNode, removeNode, updateNodeProps } from "@euginejs/core";
import { describe, expect, it } from "vitest";
import { renderToDom, SELECTED_ATTRIBUTE, type DomComponentRenderer } from "../src/dom.js";

function buildRegistry() {
  const registry = new ComponentRegistry<DomComponentRenderer>();
  registry.register({
    type: "root",
    render: (_props, children) => {
      const el = document.createElement("main");
      children.forEach((c) => el.appendChild(c));
      return el;
    },
  });
  registry.register({
    type: "section",
    render: (props, children) => {
      const el = document.createElement("section");
      el.setAttribute("data-title", String(props.title ?? ""));
      children.forEach((c) => el.appendChild(c));
      return el;
    },
  });
  registry.register({
    type: "text",
    render: (props) => {
      const el = document.createElement("p");
      el.textContent = String(props.content ?? "");
      return el;
    },
  });
  return registry;
}

describe("renderToDom", () => {
  it("renders the initial document into the container", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "hero", props: { title: "Hi" } }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "t", props: { content: "Hello" } }), "hero");

    const container = document.createElement("div");
    renderToDom(doc, container, { registry: buildRegistry() });

    expect(container.querySelector("main > section")?.getAttribute("data-title")).toBe("Hi");
    expect(container.querySelector("p")?.textContent).toBe("Hello");
  });

  it("patches only the changed node in place on update, preserving unrelated DOM element identity", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("section", { id: "hero", props: { title: "Hi" } }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "A" } }), "hero");
    doc = insertNode(doc, createNode("text", { id: "b", props: { content: "B" } }), "hero");

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry() });

    const sectionElBefore = renderer.getElement("hero");
    const bElBefore = renderer.getElement("b");

    const nextDoc = updateNodeProps(doc, "a", { content: "A2" });
    renderer.update(nextDoc);

    expect(renderer.getElement("hero")).toBe(sectionElBefore); // ancestor untouched, same DOM node reused
    expect(renderer.getElement("b")).toBe(bElBefore); // sibling untouched, same DOM node reused
    expect((renderer.getElement("a") as HTMLElement).textContent).toBe("A2");
    expect(container.querySelectorAll("p")[0]?.textContent).toBe("A2");
    expect(container.querySelectorAll("p")[1]?.textContent).toBe("B");
  });

  it("removes DOM nodes for removed document nodes and garbage-collects internal caches", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "t", props: { content: "Bye" } }), doc.rootId);

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry() });
    expect(renderer.getElement("t")).toBeDefined();

    const nextDoc = removeNode(doc, "t");
    renderer.update(nextDoc);

    expect(container.querySelector("p")).toBeNull();
    expect(renderer.getElement("t")).toBeUndefined();
  });

  it("renders a placeholder for unregistered component types instead of throwing by default", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("mystery", { id: "m" }), doc.rootId);

    const registry = new ComponentRegistry<DomComponentRenderer>();
    registry.register({
      type: "root",
      render: (_p, children) => {
        const el = document.createElement("main");
        children.forEach((c) => el.appendChild(c));
        return el;
      },
    });

    const container = document.createElement("div");
    renderToDom(doc, container, { registry });
    expect(container.querySelector('[data-eugine-type="mystery"]')).not.toBeNull();
  });

  it("marks initially-selected nodes with the selection attribute and passes ctx.selected", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "A" } }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "b", props: { content: "B" } }), doc.rootId);

    const seenSelected: Record<string, boolean> = {};
    const registry = new ComponentRegistry<DomComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => { const el = document.createElement("main"); c.forEach((n) => el.appendChild(n)); return el; } });
    registry.register({
      type: "text",
      render: (props, _c, ctx) => {
        seenSelected[ctx.node.id] = ctx.selected;
        const el = document.createElement("p");
        el.textContent = String(props.content ?? "");
        return el;
      },
    });

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry, selection: ["a"] });

    expect(seenSelected).toEqual({ a: true, b: false });
    expect((renderer.getElement("a") as HTMLElement).hasAttribute(SELECTED_ATTRIBUTE)).toBe(true);
    expect((renderer.getElement("b") as HTMLElement).hasAttribute(SELECTED_ATTRIBUTE)).toBe(false);
    expect(renderer.getSelection()).toEqual(["a"]);
  });

  it("setSelection() toggles the attribute without rebuilding the element (no reconcile)", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "A" } }), doc.rootId);

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry() });
    const elBefore = renderer.getElement("a");

    renderer.setSelection(["a"]);
    expect((renderer.getElement("a") as HTMLElement).hasAttribute(SELECTED_ATTRIBUTE)).toBe(true);
    expect(renderer.getElement("a")).toBe(elBefore); // same element — no rebuild happened

    renderer.setSelection([]);
    expect((renderer.getElement("a") as HTMLElement).hasAttribute(SELECTED_ATTRIBUTE)).toBe(false);
    expect(renderer.getElement("a")).toBe(elBefore);
  });

  it("a node rebuilt after a data change keeps reflecting current selection", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "A" } }), doc.rootId);

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry() });
    renderer.setSelection(["a"]);

    const nextDoc = updateNodeProps(doc, "a", { content: "A2" });
    renderer.update(nextDoc);

    expect((renderer.getElement("a") as HTMLElement).hasAttribute(SELECTED_ATTRIBUTE)).toBe(true);
  });

  it("prunes a removed node's id out of the tracked selection", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "A" } }), doc.rootId);

    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry(), selection: ["a"] });

    const nextDoc = removeNode(doc, "a");
    renderer.update(nextDoc);

    expect(renderer.getSelection()).toEqual([]);
  });

  it("destroy() clears the container and internal state", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "t", props: { content: "Bye" } }), doc.rootId);
    const container = document.createElement("div");
    const renderer = renderToDom(doc, container, { registry: buildRegistry() });

    renderer.destroy();
    expect(container.childNodes.length).toBe(0);
    expect(renderer.getElement("t")).toBeUndefined();
  });
});

describe("onCleanup", () => {
  function trackingRegistry(log: string[]) {
    const registry = buildRegistry();
    registry.registerOrReplace({
      type: "text",
      render: (props, _children, ctx) => {
        log.push(`setup ${String(props.content)}`);
        ctx.onCleanup(() => log.push(`cleanup ${String(props.content)}`));
        return document.createElement("p");
      },
    });
    return registry;
  }

  it("runs once when the element is rebuilt, when the node is removed, and on destroy", () => {
    const log: string[] = [];
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "a", props: { content: "a1" } }), doc.rootId);
    doc = insertNode(doc, createNode("text", { id: "b", props: { content: "b1" } }), doc.rootId);
    const renderer = renderToDom(doc, document.createElement("div"), { registry: trackingRegistry(log) });
    expect(log.splice(0)).toEqual(["setup a1", "setup b1"]);

    doc = updateNodeProps(doc, "a", { content: "a2" });
    renderer.update(doc);
    expect(log.splice(0)).toEqual(["cleanup a1", "setup a2"]); // b untouched

    doc = removeNode(doc, "a");
    renderer.update(doc);
    expect(log.splice(0)).toEqual(["cleanup a2"]);

    renderer.destroy();
    expect(log.splice(0)).toEqual(["cleanup b1"]);

    renderer.update(doc); // no-op after destroy
    expect(log).toEqual([]);
  });
});
