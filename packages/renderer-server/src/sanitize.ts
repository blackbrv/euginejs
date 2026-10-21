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
 * strip leading/trailing C0 controls and spaces (U+0000–U+0020) and every
 * ASCII tab/newline anywhere before parsing a scheme (WHATWG URL spec), so
 * `"\x01java\tscript:..."` resolves as plain `javascript:`. The scheme test
 * runs against a copy normalized the same way, or those evasions slip past.
 */
const UNSAFE_URL_SCHEME = /^(javascript|vbscript|data):/i;

/** What the WHATWG URL parser strips from both ends of a URL before reading it. */
const C0_CONTROL_OR_SPACE = /^[\x00-\x20]+|[\x00-\x20]+$/g;

/**
 * Rejects `javascript:`/`vbscript:` URLs (and data: URIs, which can also
 * carry executable HTML) that a malicious/compromised document could embed
 * in an href/src prop. Returns `null` for anything that doesn't look safe;
 * callers should omit the attribute entirely in that case.
 */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(C0_CONTROL_OR_SPACE, "");
  if (trimmed.length === 0) return null;
  const schemeCheck = trimmed.replace(/[\t\n\r]/g, "");
  if (UNSAFE_URL_SCHEME.test(schemeCheck)) return null;
  return trimmed;
}

/** A CSS property name, including custom properties (`--brand`). */
const CSS_PROPERTY = /^(--[\w-]+|-?[a-zA-Z][a-zA-Z-]*)$/;

/**
 * Serializes `node.styles` into a `property: value; ...` string for an HTML
 * `style` attribute (escape it with escapeAttribute(), as for any attribute).
 * Keeps only string/number values under valid property names, and drops any
 * value containing `;`, `{` or `}`: a value like `red; position:fixed; inset:0`
 * would otherwise start new declarations — inert in the editor, where the DOM
 * renderer's applyNodeStyles() goes through `setProperty()`, but a full-page
 * overlay in the exported HTML.
 */
export function stylesToCssText(styles: Record<string, unknown> | undefined): string {
  if (!styles) return "";
  return Object.entries(styles)
    .filter(
      ([property, value]) =>
        (typeof value === "string" || typeof value === "number") &&
        value !== "" &&
        CSS_PROPERTY.test(property) &&
        !/[;{}]/.test(String(value)),
    )
    .map(([property, value]) => `${property}: ${String(value)}`)
    .join("; ");
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
 * Any attribute starting with "on" is treated as an inline event handler. An
 * exact list of known handler names can't keep up: browsers keep adding new
 * ones (onscrollsnapchange, oncommand, ...) and vendor ones
 * (onwebkitanimationend fires with no user interaction), and every miss is
 * script execution. The cost is that inert props like "once" are dropped too.
 */
const EVENT_HANDLER_ATTRIBUTE = /^on/i;

/**
 * Renders a props object as a string of `key="value"` HTML attributes. Skips
 * empty values (`undefined`/`null`/`false`); rejects keys that aren't valid
 * attribute names, anything starting with "on" (onclick, onerror, ...), and script-bearing content attributes (`srcdoc`), since any of those
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
    if (!SAFE_ATTRIBUTE_NAME.test(key) || EVENT_HANDLER_ATTRIBUTE.test(key) || BLOCKED_ATTRIBUTES.has(lowerKey)) continue;
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
