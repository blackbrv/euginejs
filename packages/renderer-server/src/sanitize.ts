const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text content for safe inclusion in HTML output. */
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Escapes a value for safe inclusion inside a double-quoted HTML attribute. */
export function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

/**
 * Matches `javascript:`/`vbscript:`/`data:` at the start of a URL. Browsers
 * strip all ASCII tab/newline characters from a URL before parsing its scheme
 * (WHATWG URL spec), so `"java\tscript:..."` resolves as plain `javascript:`.
 * To avoid the known filter-evasion where embedded whitespace slips past the
 * regex, the scheme test runs against a copy with `\t`/`\n`/`\r` removed (the
 * return value keeps the caller's original text, matching DOMPurify etc.).
 */
const UNSAFE_URL_SCHEME = /^\s*(javascript|vbscript|data):/i;

/**
 * Rejects `javascript:`/`vbscript:` URLs (and data: URIs, which can also
 * carry executable HTML) that a malicious/compromised document could embed
 * in an href/src prop. Returns `null` for anything that doesn't look safe;
 * callers should omit the attribute entirely in that case.
 */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const schemeCheck = trimmed.replace(/[\t\n\r]/g, "");
  if (UNSAFE_URL_SCHEME.test(schemeCheck)) return null;
  return trimmed;
}

/** A syntactically valid HTML attribute name — rejecting anything else stops a hostile key from breaking out of the tag (values are escaped, but an attribute *name* can't be). */
const SAFE_ATTRIBUTE_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/;

/** Attribute names known to carry a URL — the only ones `attributesToHtml` runs through `sanitizeUrl`. */
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "xlink:href"]);

/**
 * Attribute names that are inert as far as `sanitizeUrl` goes but still
 * carry embeddable, executable markup — currently `srcdoc`, whose value the
 * HTML parser entity-decodes and treats as an entire inline HTML document
 * (a hostile `srcdoc="<script>..."` on an `<iframe>` runs script). DOMPurify
 * drops `srcdoc` for the same reason; we do too, regardless of its value.
 */
const BLOCKED_ATTRIBUTES = new Set(["srcdoc"]);

/**
 * The standard HTML/DOM inline event-handler content attributes (HTML §8.1.7.2.1
 * `GlobalEventHandlers`, plus window/document-only handlers and a few
 * long-standing vendor ones). A blanket `/^on/i` prefix match is wrong here —
 * it would also swallow ordinary, non-event props like "once" or "online" —
 * so this is an exact-match set of the names browsers actually wire up as
 * `<tag onXxx="...">`. Anything not in this list is inert as far as script
 * execution goes, even if it happens to start with "on".
 */
const EVENT_HANDLER_ATTRIBUTES = new Set([
  "onabort", "onafterprint", "onanimationcancel", "onanimationend", "onanimationiteration", "onanimationstart",
  "onauxclick", "onbeforeinput", "onbeforematch", "onbeforeprint", "onbeforetoggle", "onbeforeunload",
  "onblur", "oncancel", "oncanplay", "oncanplaythrough", "onchange", "onclick", "onclose",
  "oncontextlost", "oncontextmenu", "oncontextrestored", "oncopy", "oncuechange",
  "oncut", "ondblclick", "ondrag", "ondragend", "ondragenter", "ondragleave", "ondragover",
  "ondragstart", "ondrop", "ondurationchange", "onemptied", "onended", "onerror", "onfocus",
  "onformdata", "ongotpointercapture", "onhashchange", "oninput", "oninvalid", "onkeydown",
  "onkeypress", "onkeyup", "onlanguagechange", "onload", "onloadeddata", "onloadedmetadata",
  "onloadstart", "onlostpointercapture", "onmessage", "onmessageerror", "onmousedown",
  "onmouseenter", "onmouseleave", "onmousemove", "onmouseout", "onmouseover", "onmouseup",
  "onmousewheel", "onoffline", "ononline", "onpagehide", "onpageshow", "onpaste", "onpause",
  "onplay", "onplaying", "onpointercancel", "onpointerdown", "onpointerenter", "onpointerleave",
  "onpointermove", "onpointerout", "onpointerover", "onpointerup", "onpointerrawupdate", "onpopstate",
  "onprogress", "onratechange", "onrejectionhandled", "onreset", "onresize", "onscroll",
  "onscrollend", "onsecuritypolicyviolation", "onseeked", "onseeking", "onselect", "onshow",
  "onslotchange", "onstalled", "onstorage", "onsubmit", "onsuspend",
  "ontimeupdate", "ontoggle", "ontouchcancel", "ontouchend", "ontouchmove", "ontouchstart",
  "ontransitioncancel", "ontransitionend", "ontransitionrun", "ontransitionstart",
  "onunhandledrejection", "onunload", "onvolumechange", "onwaiting", "onwheel",
]);

/**
 * Renders a props object as a string of `key="value"` HTML attributes. Skips
 * empty values (`undefined`/`null`/`false`); rejects keys that aren't valid
 * attribute names, known inline event-handler attributes (onclick, onerror,
 * ...), and script-bearing content attributes (`srcdoc`), since any of those
 * could otherwise let a hostile document break out of the tag or run script;
 * sanitizes known URL attributes (href/src/action/formaction) against
 * `javascript:`/`vbscript:`/`data:` schemes via sanitizeUrl(). This makes it
 * safe to call directly on attacker-influenced node props (see PRD §59–63);
 * it does not know which *other* keys are meant to be URLs, so a custom
 * URL-valued prop still needs its own sanitizeUrl() call.
 */
export function attributesToHtml(attributes: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    const lowerKey = key.toLowerCase();
    if (!SAFE_ATTRIBUTE_NAME.test(key) || EVENT_HANDLER_ATTRIBUTES.has(lowerKey) || BLOCKED_ATTRIBUTES.has(lowerKey)) continue;
    if (value === true) {
      parts.push(key);
      continue;
    }
    if (URL_ATTRIBUTES.has(lowerKey)) {
      const safeUrl = sanitizeUrl(value);
      if (safeUrl === null) continue;
      parts.push(`${key}="${escapeAttribute(safeUrl)}"`);
      continue;
    }
    parts.push(`${key}="${escapeAttribute(value)}"`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}
