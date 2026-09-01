/**
 * Host-agnostic helper for fetching Pokémon from the public PokeAPI. This
 * module imports nothing from the editor, the DOM renderer, or React, so it
 * can be called identically from the client-side data plugin
 * (`lib/pokemonDataPlugin.ts`) and from the server-side `/preview` route
 * (`app/preview/page.tsx`).
 *
 * The "data source" every pokemon component points at is the PokeAPI list
 * endpoint; each entry's id is parsed out of its `url` so we can build the
 * sprite URL directly instead of doing an N+1 detail fetch per Pokémon.
 */
export interface PokemonSummary {
  id: number;
  name: string;
  spriteUrl: string;
}

export interface PokemonPage {
  items: PokemonSummary[];
  hasMore: boolean;
}

interface PokeApiListResponse {
  results: { name: string; url: string }[];
  next: string | null;
}

const LIST_ENDPOINT = "https://pokeapi.co/api/v2/pokemon";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const ID_FROM_URL = /\/pokemon\/(\d+)\/?$/;

export async function fetchPokemonPage(offset: number, limit: number): Promise<PokemonPage> {
  const url = `${LIST_ENDPOINT}?offset=${offset}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokeAPI request failed with status ${response.status}`);
  }
  const json = (await response.json()) as PokeApiListResponse;

  const items: PokemonSummary[] = json.results.map((entry) => {
    const match = ID_FROM_URL.exec(entry.url);
    const id = match ? Number(match[1]) : 0;
    return {
      id,
      name: entry.name,
      spriteUrl: id > 0 ? `${SPRITE_BASE}/${id}.png` : "",
    };
  });

  return { items, hasMore: Boolean(json.next) };
}
