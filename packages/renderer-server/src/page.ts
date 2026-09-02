import type { EugineDocument } from "@euginejs/core";
import { renderToString, type RenderToStringOptions } from "./html.js";
import { attributesToHtml, escapeHtml } from "./sanitize.js";

export interface RenderToPageOptions<TData = unknown> extends RenderToStringOptions<TData> {
  /** `<title>` text, escaped. No `<title>` tag at all is emitted if this is `undefined`; pass `""` for an explicit empty `<title></title>`. */
  title?: string;
  /** BCP 47 language tag for `<html lang="...">`. Defaults to `"en"`. */
  lang?: string;
  /**
   * Raw CSS inlined into a `<style>` tag in `<head>`. Eugine has no CSS
   * pipeline of its own — this is exactly whatever stylesheet text your own
   * build already produced (a Tailwind build's output, a bundler's
   * extracted CSS, a static file's contents, a `<link>` you'd rather inline
   * for a single self-contained file, ...). Not escaped as HTML (it's CSS,
   * not markup) — this is your own trusted stylesheet text, not
   * document-provided data — but a literal `</style` sequence inside it is
   * still neutralized, since the HTML parser would otherwise close the tag
   * early regardless of whether that sequence was intentional.
   */
  css?: string;
  /**
   * Raw HTML appended into `<head>` verbatim — a `<link>`, an extra
   * `<meta>`, a CSP nonce `<script>`. Not escaped, for the same reason
   * `css` isn't: this is markup you wrote, not data a document author
   * supplied.
   */
  head?: string;
  /** Attributes merged onto `<body>` (e.g. `{ class: "theme-light" }`); values are escaped the same way `attributesToHtml` escapes any other attribute. */
  bodyAttributes?: Record<string, string>;
}

/**
 * Splits up a literal `</style` (any case) so the HTML parser can't read it
 * as this element's close tag early — inserting a CSS comment is inert
 * everywhere in the CSS token stream, so this changes nothing about how
 * legitimate stylesheet text is interpreted. The HTML parser looks for this
 * substring literally while consuming `<style>` as raw text, regardless of
 * whether the surrounding text is valid CSS or how it got there (a
 * generated stylesheet colliding with this by accident is a realistic way
 * for it to appear, not just a deliberately hostile one).
 */
function breakStyleCloseTag(css: string): string {
  return css.replace(/<\/style/gi, "</*eugine*//style");
}

/**
 * Assembles a complete, standalone HTML document around `renderToString()`'s
 * output — the `<!doctype html>`/`<html>`/`<head>`/`<body>` shell that
 * `renderToString()` deliberately does not add on its own. That's not an
 * oversight: a document's own root component might already render a full
 * `<html>` layout (embedding into an existing page, e.g. a Next.js Server
 * Component), and wrapping that unconditionally would double-wrap it or
 * force every host into the same shell — see `renderToString()`'s own docs.
 *
 * Reach for `renderToPage()` specifically when you want a byte-ready
 * `.html` file or an HTTP response body for a static page. Keep using
 * `renderToString()` directly for embedding into markup you already
 * control.
 */
export function renderToPage<TData = unknown>(document: EugineDocument, options: RenderToPageOptions<TData>): string {
  const body = renderToString(document, options);
  const htmlAttrs = attributesToHtml({ lang: options.lang ?? "en" });
  const titleTag = options.title !== undefined ? `<title>${escapeHtml(options.title)}</title>` : "";
  const styleTag = options.css !== undefined ? `<style>${breakStyleCloseTag(options.css)}</style>` : "";
  const bodyAttrs = attributesToHtml(options.bodyAttributes ?? {});

  return (
    `<!doctype html><html${htmlAttrs}><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `${titleTag}${options.head ?? ""}${styleTag}</head>` +
    `<body${bodyAttrs}>${body}</body></html>`
  );
}
