import { describe, expect, it } from "vitest";
import { createEditor } from "eugine";
import { renderToDom, type DomComponentRenderer } from "eugine/renderer";
import { renderToString, type HtmlComponentRenderer } from "eugine/server";
import { MemoryVersionAdapter, Versioning, VersioningError } from "eugine/versioning";
import { ComponentRegistry } from "@eugine/core";

/**
 * End-to-end smoke test of the developer workflow described in the PRD
 * (§123): install → create editor → register components → build a
 * document → serialize → persist/reload → render, both in the browser and
 * on the server, from a single canonical document.
 */
describe("eugine end-to-end", () => {
  it("builds a document with the editor, then renders identical output on the server and in the DOM", () => {
    const editor = createEditor({
      components: [
        { type: "section", accepts: "*", defaults: { props: { title: "Untitled" } } },
        { type: "text", accepts: "none" },
      ],
    });

    const root = editor.getDocument().rootId;
    const heroId = editor.insert("section", root, { props: { title: "Build faster" } });
    editor.insert("text", heroId, { props: { content: "Ship your own page builder." } });

    // Persist + reload through the canonical JSON envelope.
    const serialized = editor.serialize();
    const reloaded = createEditor();
    reloaded.load(serialized);
    expect(reloaded.serialize()).toEqual(serialized);

    // Server-side render: no editor, no browser APIs, just document + registry.
    const htmlRegistry = new ComponentRegistry<HtmlComponentRenderer>();
    htmlRegistry.register({ type: "root", render: (_p, c) => `<main>${c}</main>` });
    htmlRegistry.register({
      type: "section",
      render: (props, c) => `<section><h1>${String(props.title)}</h1>${c}</section>`,
    });
    htmlRegistry.register({ type: "text", render: (props) => `<p>${String(props.content)}</p>` });

    const html = renderToString(reloaded.getDocument(), { registry: htmlRegistry });
    expect(html).toBe(
      "<main><section><h1>Build faster</h1><p>Ship your own page builder.</p></section></main>",
    );

    // Browser render of the SAME reloaded document, via a DOM-flavored registry.
    const domRegistry = new ComponentRegistry<DomComponentRenderer>();
    domRegistry.register({
      type: "root",
      render: (_p, children) => {
        const el = document.createElement("main");
        children.forEach((c) => el.appendChild(c));
        return el;
      },
    });
    domRegistry.register({
      type: "section",
      render: (props, children) => {
        const el = document.createElement("section");
        const h1 = document.createElement("h1");
        h1.textContent = String(props.title);
        el.appendChild(h1);
        children.forEach((c) => el.appendChild(c));
        return el;
      },
    });
    domRegistry.register({
      type: "text",
      render: (props) => {
        const el = document.createElement("p");
        el.textContent = String(props.content);
        return el;
      },
    });

    const container = document.createElement("div");
    renderToDom(reloaded.getDocument(), container, { registry: domRegistry });
    expect(container.innerHTML).toBe(html);
  });

  it("keeps document state (props/children) fully independent from editor state (selection)", () => {
    const editor = createEditor({ components: [{ type: "box" }] });
    const id = editor.insert("box", editor.getDocument().rootId);
    editor.selection.select(id);

    const beforeDeselect = editor.serialize();
    editor.selection.deselect();
    const afterDeselect = editor.serialize();

    // Selecting/deselecting a node must never change the persisted document.
    expect(beforeDeselect).toEqual(afterDeselect);
    expect(JSON.stringify(beforeDeselect)).not.toContain("selection");
  });

  it("exposes the versioning plugin through the eugine/versioning subpath", async () => {
    const versioning = new Versioning({ adapter: new MemoryVersionAdapter() });
    const editor = createEditor();
    editor.use(versioning);

    const version = await versioning.createVersion({ label: "v1" });
    expect(version.label).toBe("v1");
    expect(await versioning.listVersions()).toHaveLength(1);
    expect(VersioningError).toBeTypeOf("function");
  });
});
