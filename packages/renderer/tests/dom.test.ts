import { ComponentRegistry, createEmptyDocument, createNode, insertNode, removeNode, updateNodeProps } from "@eugine/core";
import { describe, expect, it } from "vitest";
import { renderToDom, type DomComponentRenderer } from "../src/dom.js";

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
