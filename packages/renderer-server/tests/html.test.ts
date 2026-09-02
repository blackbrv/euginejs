import { ComponentRegistry, createEmptyDocument, createNode, insertNode } from "@euginejs/core";
import { describe, expect, it } from "vitest";
import { renderToString, type HtmlComponentRenderer } from "../src/html.js";
import { attributesToHtml, escapeHtml, sanitizeUrl } from "../src/sanitize.js";

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

describe("attributesToHtml", () => {
  it("renders plain string and boolean attributes, escaping values", () => {
    expect(attributesToHtml({ title: 'a "quote"', disabled: true, hidden: false, id: undefined })).toBe(
      ' title="a &quot;quote&quot;" disabled',
    );
  });

  it("rejects a hostile attribute name instead of emitting it raw", () => {
    // A malicious key trying to break out of the attribute/tag entirely.
    const html = attributesToHtml({ ['x"><script>alert(1)</script']: "y" });
    expect(html).toBe("");
  });

  it("drops known inline event-handler attributes regardless of value", () => {
    expect(attributesToHtml({ onclick: "alert(1)", onError: "alert(2)" })).toBe("");
    // Newer GlobalEventHandlers names (beforeinput, scrollend, ...) that a
    // hostile document could otherwise use to smuggle script through.
    expect(attributesToHtml({ onbeforeinput: "alert(1)", onscrollend: "alert(2)" })).toBe("");
    // Transition/animation handlers, including the ones that appeared alongside
    // their already-blocked siblings (animationcancel, transitionstart/run/cancel).
    expect(attributesToHtml({ onanimationcancel: "alert(1)" })).toBe("");
    expect(
      attributesToHtml({ ontransitionstart: "a", ontransitionrun: "b", ontransitioncancel: "c" }),
    ).toBe("");
  });

  it("drops the script-bearing srcdoc content attribute regardless of value", () => {
    // A hostile <iframe srcdoc="..."> is entity-decoded and treated as an
    // entire inline HTML document — the value is not a URL, so sanitizeUrl()
    // wouldn't catch it; it must be blocked outright like an event handler.
    expect(attributesToHtml({ srcdoc: "<script>alert(1)</script>" })).toBe("");
    expect(attributesToHtml({ srcdoc: "plain text" })).toBe("");
    expect(attributesToHtml({ SrcDoc: "<script>alert(1)</script>" })).toBe("");
  });

  it("does not drop an ordinary attribute that merely starts with \"on\"", () => {
    // A blanket /^on/ prefix match would wrongly swallow these — only exact,
    // known event-handler names are filtered.
    expect(attributesToHtml({ once: "true" })).toBe(' once="true"');
    expect(attributesToHtml({ online: "yes" })).toBe(' online="yes"');
    expect(attributesToHtml({ onSurface: "primary" })).toBe(' onSurface="primary"');
  });

  it("sanitizes known URL attributes against unsafe schemes", () => {
    expect(attributesToHtml({ href: "javascript:alert(1)" })).toBe("");
    expect(attributesToHtml({ src: "data:text/html,<script>alert(1)</script>" })).toBe("");
    expect(attributesToHtml({ href: "https://example.com" })).toBe(' href="https://example.com"');
  });

  it("does not sanitize a URL scheme on an attribute it doesn't recognize as a URL", () => {
    // attributesToHtml only special-cases known URL attribute names; anything
    // else is the caller's responsibility, as documented on the function.
    expect(attributesToHtml({ "data-link": "javascript:alert(1)" })).toBe(
      ' data-link="javascript:alert(1)"',
    );
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

  it("rejects unsafe schemes even when tab/newline/CR are embedded inside the scheme word", () => {
    // Browsers strip all ASCII tab/newline chars before parsing a URL's
    // scheme (WHATWG), so "java\tscript:..." resolves as plain "javascript:"
    // despite the embedded tab. trim() alone doesn't remove these — the
    // sanitizer must, or an href/src slips through and executes.
    expect(sanitizeUrl("java\tscript:alert(1)")).toBeNull();
    expect(sanitizeUrl("java\nscript:alert(1)")).toBeNull();
    expect(sanitizeUrl("java\rscript:alert(1)")).toBeNull();
    expect(sanitizeUrl("java\t\n\rscript:alert(1)")).toBeNull();
    // ...case-insensitive and around leading whitespace too.
    expect(sanitizeUrl("  VBS\tCRIPT:msgbox(1)")).toBeNull();
    expect(sanitizeUrl("DA\nTA:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("attributesToHtml drops href/src values with whitespace-obfuscated unsafe schemes", () => {
    // The automatic href/src/action/formaction sanitization relies on
    // sanitizeUrl, so the embedded-whitespace evasion must not slip through it.
    expect(attributesToHtml({ href: "java\tscript:alert(1)" })).toBe("");
    expect(attributesToHtml({ src: "java\nscript:alert(1)" })).toBe("");
    expect(attributesToHtml({ href: "java\rscript:alert(1)" })).toBe("");
  });

  it("preserves the caller's original text on allow (including embedded whitespace that isn't a scheme)", () => {
    // The regression fix strips tab/newline only for the scheme check; the
    // returned value is the caller's trimmed original, not the stripped copy.
    expect(sanitizeUrl("https://example.com/path\tname")).toBe("https://example.com/path\tname");
  });
});
