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
  if (UNSAFE_URL_SCHEME.test(trimmed)) return null;
  return trimmed;
}

/** Renders a props object as a string of `key="value"` HTML attributes, skipping unsafe/empty values. */
export function attributesToHtml(attributes: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${escapeAttribute(value)}"`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}
