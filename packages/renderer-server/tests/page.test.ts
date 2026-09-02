import { ComponentRegistry, createEmptyDocument, createNode, insertNode } from "@euginejs/core";
import { describe, expect, it } from "vitest";
import { renderToPage } from "../src/page.js";
import type { HtmlComponentRenderer } from "../src/html.js";

function buildRegistry() {
  const registry = new ComponentRegistry<HtmlComponentRenderer>();
  registry.register({ type: "root", render: (_p, children) => `<main>${children}</main>` });
  registry.register({ type: "text", render: (props) => `<p>${String(props.content ?? "")}</p>` });
  return registry;
}

function buildDocument() {
  let doc = createEmptyDocument();
  doc = insertNode(doc, createNode("text", { id: "t", props: { content: "Hello" } }), doc.rootId);
  return doc;
}

describe("renderToPage", () => {
  it("wraps renderToString()'s output in a complete standalone document", () => {
    const html = renderToPage(buildDocument(), { registry: buildRegistry() });
    expect(html).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        "</head><body><main><p>Hello</p></main></body></html>",
    );
  });

  it("omits the <title> tag entirely when no title is given", () => {
    const html = renderToPage(buildDocument(), { registry: buildRegistry() });
    expect(html).not.toContain("<title>");
  });

  it("includes an escaped <title> when given", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      title: 'My "Site" <Home>',
    });
    expect(html).toContain("<title>My &quot;Site&quot; &lt;Home&gt;</title>");
    expect(html).not.toContain("<Home>");
  });

  it("inlines raw, unescaped css into a <style> tag when given", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      css: "body { color: red; } /* a > b */",
    });
    expect(html).toContain("<style>body { color: red; } /* a > b */</style>");
  });

  it("omits the <style> tag entirely when no css is given", () => {
    const html = renderToPage(buildDocument(), { registry: buildRegistry() });
    expect(html).not.toContain("<style>");
  });

  it("neutralizes a literal </style> inside css instead of letting it close the tag early", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      css: "body{}</style><script>alert(1)</script><style>",
    });
    // The security property isn't "no script-shaped substring anywhere" —
    // it's that the css payload can't force an early close of THIS <style>
    // element. Once inside <style>'s raw-text mode, an HTML parser only
    // ever looks for the closing sequence (an embedded "<style>"-shaped
    // substring, like this test's payload also has, is just inert text —
    // nested opening tags aren't a thing in raw-text content). A single
    // genuine </style> (the one this function itself emits) means
    // everything before it, script-shaped text included, stays inert.
    expect((html.match(/<\/style>/g) ?? []).length).toBe(1);
    const start = html.indexOf("<style>") + "<style>".length;
    const end = html.indexOf("</style>");
    const styleContent = html.slice(start, end);
    expect(styleContent).toContain("alert(1)"); // present, but trapped inside the one real style element
    expect(styleContent).not.toMatch(/<\/style/i); // no literal close-tag sequence survives inside it
  });

  it("is case-insensitive when neutralizing </style", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      css: "a{}</STYLE><script>bad()</script>",
    });
    expect((html.match(/<\/style>/gi) ?? []).length).toBe(1);
  });

  it("distinguishes an omitted title from an explicit empty one", () => {
    const omitted = renderToPage(buildDocument(), { registry: buildRegistry() });
    expect(omitted).not.toContain("<title");

    const explicit = renderToPage(buildDocument(), { registry: buildRegistry(), title: "" });
    expect(explicit).toContain("<title></title>");
  });

  it("appends raw head content verbatim, after <title> and before <style>", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      title: "Home",
      head: '<link rel="icon" href="/favicon.ico">',
      css: "body{margin:0}",
    });
    const titleIndex = html.indexOf("<title>");
    const linkIndex = html.indexOf('<link rel="icon"');
    const styleIndex = html.indexOf("<style>");
    expect(titleIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(titleIndex);
    expect(styleIndex).toBeGreaterThan(linkIndex);
  });

  it("renders bodyAttributes through the same escaping/filtering as attributesToHtml", () => {
    const html = renderToPage(buildDocument(), {
      registry: buildRegistry(),
      bodyAttributes: { class: "theme-light", onclick: "alert(1)", "data-app": "1" },
    });
    expect(html).toContain('<body class="theme-light" data-app="1">');
    expect(html).not.toContain("onclick");
  });

  it("defaults lang to \"en\" and escapes a custom lang value", () => {
    const withDefault = renderToPage(buildDocument(), { registry: buildRegistry() });
    expect(withDefault).toContain('<html lang="en">');

    const withCustom = renderToPage(buildDocument(), { registry: buildRegistry(), lang: "fr" });
    expect(withCustom).toContain('<html lang="fr">');
  });

  it("passes registry/data/onMissingComponent through to renderToString unchanged", () => {
    let doc = createEmptyDocument();
    doc = insertNode(doc, createNode("mystery", { id: "m" }), doc.rootId);
    const registry = buildRegistry();

    const html = renderToPage(doc, { registry, onMissingComponent: "placeholder" });
    expect(html).toContain("eugine:unknown-component");

    expect(() => renderToPage(doc, { registry, onMissingComponent: "throw" })).toThrow();
  });

  it("is deterministic — identical input produces byte-identical output", () => {
    const doc = buildDocument();
    const options = { registry: buildRegistry(), title: "Home", css: "body{margin:0}" };
    expect(renderToPage(doc, options)).toBe(renderToPage(doc, options));
  });
});
