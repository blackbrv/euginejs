import { renderToString } from "eugine/server";
import { createSampleDocument } from "@/lib/document";
import { createHtmlRegistry } from "@/lib/htmlRegistry";

/**
 * A Server Component. `renderToString` never imports `window`/`document`,
 * so this runs entirely on the server — the editor runtime is never loaded
 * and no editor-related JavaScript ships to the browser for this route.
 * This is the "Static Output" mode described in the Eugine PRD: JSON -> HTML,
 * no hydration required just to display a published page.
 */
export default function Home() {
  const document = createSampleDocument();
  const html = renderToString(document, { registry: createHtmlRegistry() });

  return (
    <>
      <h2>Server-rendered</h2>
      <p>
        The HTML below was produced by <code>renderToString()</code> from <code>eugine/server</code>,
        run inside this Next.js Server Component. View source — there is no editor runtime on this page.
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
