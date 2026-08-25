import { ComponentRegistry, createEmptyDocument, createNode, insertNode } from "@eugine/core";
import { describe, expect, it } from "vitest";
import { renderToString, type HtmlComponentRenderer } from "../src/html.js";
import { escapeHtml, sanitizeUrl } from "../src/sanitize.js";

function buildDocument() {
  let doc = createEmptyDocument();
  doc = insertNode(doc, createNode("section", { id: "hero", props: { title: "Build faster" } }), doc.rootId);
  doc = insertNode(doc, createNode("text", { id: "heading", props: { content: "Hello <b>world</b>" } }), "hero");
  return doc;
}

describe("renderToString", () => {
  it("renders registered components deterministically", () => {
    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_props, children) => `<main>${children}</main>` });
    registry.register({
      type: "section",
      render: (props, children) => `<section><h1>${escapeHtml(props.title)}</h1>${children}</section>`,
    });
    registry.register({ type: "text", render: (props) => `<p>${escapeHtml(props.content)}</p>` });

    const document = buildDocument();
    const html1 = renderToString(document, { registry });
    const html2 = renderToString(document, { registry });

    expect(html1).toBe(html2);
    expect(html1).toBe(
      '<main><section><h1>Build faster</h1><p>Hello &lt;b&gt;world&lt;/b&gt;</p></section></main>',
    );
  });

  it("escapes text content instead of injecting raw HTML from document props", () => {
    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => c });
    registry.register({ type: "section", render: (_p, c) => c });
    registry.register({ type: "text", render: (props) => `<p>${escapeHtml(props.content)}</p>` });

    const html = renderToString(buildDocument(), { registry });
    expect(html).not.toContain("<b>world</b>");
    expect(html).toContain("&lt;b&gt;world&lt;/b&gt;");
  });

  it("never dynamically executes a document-provided module reference", () => {
    // Simulates a hostile document trying to name an arbitrary module/path as its type,
    // hoping the renderer will `import()` it. It must instead be treated as inert data:
    // rendered as a harmless, escaped placeholder comment — never imported or executed.
    let doc = createEmptyDocument();
    doc = insertNode(
      doc,
      createNode('../../malicious-module"--><script>alert(1)</script>', { id: "evil" }),
      doc.rootId,
    );

    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => c });
    // The malicious type string is intentionally NOT registered.

    const html = renderToString(doc, { registry, onMissingComponent: "placeholder" });
    expect(html).toContain("eugine:unknown-component");
    // The attempted comment-breakout / script tag must come out HTML-escaped, not raw.
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("supports omit and throw strategies for unknown components", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("mystery", { id: "m" }), doc.rootId);
    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => c });

    expect(renderToString(doc, { registry, onMissingComponent: "omit" })).toBe("");
    expect(() => renderToString(doc, { registry, onMissingComponent: "throw" })).toThrow();
  });

  it("omits hidden nodes from output", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("text", { id: "t", hidden: true, props: { content: "secret" } }), doc.rootId);
    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => c });
    registry.register({ type: "text", render: (props) => `<p>${escapeHtml(props.content)}</p>` });

    expect(renderToString(doc, { registry })).toBe("");
  });

  it("falls back to a structural wrapper when a component has no render function", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("card", { id: "c", className: "my-card" }), doc.rootId);
    const registry = new ComponentRegistry<HtmlComponentRenderer>();
    registry.register({ type: "root", render: (_p, c) => c });
    registry.register({ type: "card" });

    const html = renderToString(doc, { registry });
    expect(html).toContain('data-eugine-type="card"');
    expect(html).toContain('class="my-card"');
  });

  it("passes a data context through to component renderers", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("greeting", { id: "g" }), doc.rootId);
    const registry = new ComponentRegistry<HtmlComponentRenderer<{ user: { name: string } }>>();
    registry.register({ type: "root", render: (_p, c) => c });
    registry.register({
      type: "greeting",
      render: (_props, _children, ctx) => `<p>Hello ${escapeHtml(ctx.data?.user.name)}</p>`,
    });

    const html = renderToString(doc, { registry, data: { user: { name: "James" } } });
    expect(html).toBe("<p>Hello James</p>");
  });

  it("does not reference any browser globals", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/html.ts", import.meta.url), "utf8"));
    // NB: the source legitimately has a parameter named `document` (an
    // EugineDocument value) — that is not the DOM global, so we only check
    // for actual browser-only API surfaces here.
    for (const forbidden of ["window.", "globalThis.window", "localStorage.", "HTMLElement", "ResizeObserver", "addEventListener"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("sanitizeUrl", () => {
  it("rejects javascript: and vbscript: and data: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("  JAVASCRIPT:alert(1)")).toBeNull();
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("allows normal http(s) and relative URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeUrl("/about")).toBe("/about");
  });
});
