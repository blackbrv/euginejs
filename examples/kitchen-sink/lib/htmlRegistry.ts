import { ComponentRegistry, type EugineNode } from "eugine";
import { escapeAttribute, escapeHtml, sanitizeUrl, type HtmlComponentRenderer } from "eugine/server";
import type { PokemonSummary } from "./pokeApi";
import { stylesToCssText } from "./styleFields";

/**
 * Per-node, freshly-fetched Pokémon payloads keyed by node id. Built server-
 * side at request time (see app/preview/page.tsx) — never persisted
 * anywhere, exactly like the client plugin's ephemeral state.
 */
export type PreviewData = Map<string, PokemonSummary[]>;

/** The design panel's styles become an inline `style="..."` attribute, kept in sync with the canvas. */
function styleAttr(node: EugineNode): string {
  const css = stylesToCssText(node.styles);
  return css ? ` style="${escapeAttribute(css)}"` : "";
}

function pokemonCardsMarkup(items: PokemonSummary[]): string {
  return items
    .map(
      (pokemon) =>
        `<figure class="ks-pokemon-card"><img src="${escapeAttribute(pokemon.spriteUrl)}" alt="${escapeAttribute(pokemon.name)}" loading="lazy"><figcaption>${escapeHtml(pokemon.name)} #${pokemon.id}</figcaption></figure>`,
    )
    .join("");
}

export function createHtmlRegistry(): ComponentRegistry<HtmlComponentRenderer<PreviewData>> {
  const registry = new ComponentRegistry<HtmlComponentRenderer<PreviewData>>();

  registry.register({ type: "root", render: (_p, children, ctx) => `<div class="ks-page"${styleAttr(ctx.node)}>${children}</div>` });
  registry.register({
    type: "section",
    render: (_p, children, ctx) => `<section class="ks-section"${styleAttr(ctx.node)}>${children}</section>`,
  });
  registry.register({
    type: "container",
    render: (_p, children, ctx) => `<div class="ks-container"${styleAttr(ctx.node)}>${children}</div>`,
  });
  registry.register({ type: "grid", render: (_p, children, ctx) => `<div class="ks-grid"${styleAttr(ctx.node)}>${children}</div>` });
  registry.register({
    type: "card",
    render: (props, children, ctx) => `<div class="ks-card"${styleAttr(ctx.node)}><h3>${escapeHtml(props.title)}</h3>${children}</div>`,
  });
  registry.register({
    type: "heading",
    render: (props, _children, ctx) => `<h2${styleAttr(ctx.node)}>${escapeHtml(props.content)}</h2>`,
  });
  registry.register({
    type: "text",
    render: (props, _children, ctx) => `<p${styleAttr(ctx.node)}>${escapeHtml(props.content)}</p>`,
  });
  registry.register({
    type: "button",
    render: (props, _children, ctx) => {
      const href = sanitizeUrl(props.href) ?? "#";
      return `<a class="ks-button" href="${escapeAttribute(href)}"${styleAttr(ctx.node)}>${escapeHtml(props.label)}</a>`;
    },
  });

  registry.register({
    type: "pokemon-carousel",
    render: (props, _children, ctx) => {
      const items = ctx.data?.get(ctx.node.id) ?? [];
      const cards = pokemonCardsMarkup(items);
      // Honest static rendering of an interactive widget: a CSS-scrollable
      // snap track with no JS — swipe/scroll-only on the published page.
      return `<div class="ks-pokemon-carousel"${styleAttr(ctx.node)}><div class="ks-pokemon-track">${cards}</div></div>`;
    },
  });

  registry.register({
    type: "pokemon-grid",
    render: (props, _children, ctx) => {
      const items = ctx.data?.get(ctx.node.id) ?? [];
      const cards = pokemonCardsMarkup(items);
      // Grid reflects whatever `page` was persisted. No "load more" — there's
      // no client JS on this route, so the control would do nothing.
      return `<div class="ks-pokemon-grid"${styleAttr(ctx.node)}>${cards}</div>`;
    },
  });

  return registry;
}
