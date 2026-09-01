import { renderToString } from "eugine/server";
import { getPublishedDocument } from "@/lib/store";
import { createHtmlRegistry } from "@/lib/htmlRegistry";
import { fetchPokemonPage, type PokemonSummary } from "@/lib/pokeApi";

// The published document is mutable server-side state (see lib/store.ts), so
// this page must never be statically cached.
export const dynamic = "force-dynamic";

const POKEMON_TYPES = new Set(["pokemon-carousel", "pokemon-grid"]);

async function buildPokemonData(document: {
  nodes: Record<string, { id: string; type: string; props: Record<string, unknown> }>;
}): Promise<Map<string, PokemonSummary[]>> {
  const map = new Map<string, PokemonSummary[]>();
  const fetches: Promise<void>[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!POKEMON_TYPES.has(node.type)) continue;
    const pageSize = Number(node.props.pageSize ?? (node.type === "pokemon-grid" ? 8 : 10)) || 10;
    // Grid pages accumulate: herd through the persisted `page` cursor, so the
    // published page reflects exactly how far the editor had paginated.
    const pages = node.type === "pokemon-grid" ? (Number(node.props.page) || 0) + 1 : 1;
    const limit = pageSize * pages;
    fetches.push(
      fetchPokemonPage(0, limit)
        .then((page) => {
          map.set(node.id, page.items);
        })
        .catch(() => {
          /* A failed fetch renders as an empty set — the node just has no cards. */
        }),
    );
  }

  await Promise.all(fetches);
  return map;
}

/**
 * The "renderer runtime" half of the split described throughout the PRD
 * (most explicitly §10, §38, §71): this Server Component never imports the
 * editor, never touches the DOM, and would render identically if it fetched
 * the document from a real database instead of an in-memory module. It is
 * also the concrete realization of "a page that fetches paginated JSON data"
 * — pokemon payloads are fetched fresh, server-side, on every request.
 */
export default async function PreviewPage() {
  const saved = getPublishedDocument();

  if (!saved) {
    return <p>Nothing published yet — open the editor and click “Publish”.</p>;
  }

  const data = await buildPokemonData(saved.document);
  const html = renderToString(saved.document, { registry: createHtmlRegistry(), data });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
