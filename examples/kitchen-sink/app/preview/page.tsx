import { renderToString } from "eugine/server";
import { getPublishedDocument } from "@/lib/store";
import { createHtmlRegistry } from "@/lib/htmlRegistry";

// The published document is mutable server-side state (see lib/store.ts), so
// this page must never be statically cached.
export const dynamic = "force-dynamic";

/**
 * The "renderer runtime" half of the split described throughout the PRD
 * (most explicitly §10, §38, §71): this Server Component never imports the
 * editor, never touches the DOM, and would render identically if it fetched
 * the document from a real database instead of an in-memory module.
 */
export default function PreviewPage() {
  const saved = getPublishedDocument();

  if (!saved) {
    return <p>Nothing published yet — open the editor and click “Publish”.</p>;
  }

  const html = renderToString(saved.document, { registry: createHtmlRegistry() });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
