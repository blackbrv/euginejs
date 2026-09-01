import { type Editor, type EugineNode, type EuginePlugin } from "eugine";
import type { DomRenderer } from "eugine/renderer";
import { fetchPokemonPage, type PokemonSummary } from "./pokeApi";

/**
 * Ephemeral, per-node data state for the pokemon components. Nothing here is
 * ever persisted into the document — only the small editorial config
 * (`dataSource`, `pageSize`, and the grid's `page` cursor) lives in node
 * props, and `page` is bumped via a normal undoable `editor.updateProps`.
 * The fetched item payloads themselves live only in this in-memory map.
 */
export interface PokemonNodeState {
  items: PokemonSummary[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const POKEMON_TYPES = new Set(["pokemon-carousel", "pokemon-grid"]);

function isPokemonNode(node: EugineNode): boolean {
  return POKEMON_TYPES.has(node.type);
}

export interface PokemonDataPlugin extends EuginePlugin<Editor> {
  /**
   * Hands the plugin a live DOM renderer so it can imperatively patch a
   * node's element once a fetch resolves — the same bypass-history-and-mutate-
   * the-live-element pattern `previewStyle` uses for styles. Unlike the
   * editor's `data` bag, this is a channel that actually reaches an already-
   * mounted canvas element (see `lib/canvas.ts`).
   */
  attachRenderer(renderer: DomRenderer): void;
  /** Returns the renderer handed to attachRenderer() (or null before that). */
  getRenderer(): DomRenderer | null;
  /** Returns the ephemeral fetched state for a node, if any. */
  getState(nodeId: string): PokemonNodeState | undefined;
  /** Fetches/appends the next page for a grid node and bumps its persisted `page`. */
  loadMore(nodeId: string): Promise<void>;
  /** Subscribe to per-node state changes. Returns an unsubscribe function. */
  subscribe(nodeId: string, cb: () => void): () => void;
}

export function createPokemonDataPlugin(onActivity: (line: string) => void): PokemonDataPlugin {
  const states = new Map<string, PokemonNodeState>();
  const listeners = new Map<string, Set<() => void>>();

  let editor: Editor | null = null;
  let renderer: DomRenderer | null = null;
  let unsubscribeNodeCreate: (() => void) | null = null;
  let unsubscribeDocumentLoad: (() => void) | null = null;

  const notify = (nodeId: string) => {
    for (const cb of listeners.get(nodeId) ?? []) {
      try {
        cb();
      } catch (error) {
        console.warn("[kitchen-sink] pokemon subscriber threw:", error);
      }
    }
  };

  /** Sets loading + notifies; returns the previous state after re-setting it. */
  const beginFetch = (nodeId: string): PokemonNodeState => {
    const current = states.get(nodeId) ?? {
      items: [],
      offset: 0,
      hasMore: true,
      loading: false,
      error: null,
    };
    const loading: PokemonNodeState = { ...current, loading: true, error: null };
    states.set(nodeId, loading);
    notify(nodeId);
    return current;
  };

  const offsetFor = (nodeId: string, current: PokemonNodeState): number => {
    const node = editor?.getDocument()?.nodes[nodeId];
    if (node?.type === "pokemon-grid") {
      // Grid nodes page cumulatively: offset derived from how much we've
      // already loaded, so "Load more" always appends the next page.
      return current.items.length;
    }
    // Carousel nodes always start from the top.
    return 0;
  };

  const requestInitialFetch = (nodeId: string): void => {
    if (states.has(nodeId)) return; // already fetching or fetched
    const node = editor?.getDocument()?.nodes[nodeId];
    if (!isPokemonNode(node as EugineNode)) return;

    const current = beginFetch(nodeId);
    const limit = Number((node as EugineNode).props.pageSize ?? 10) || 10;
    const offset = offsetFor(nodeId, current);

    fetchPokemonPage(offset, limit)
      .then((page) => {
        states.set(nodeId, {
          items: page.items,
          offset: offset + page.items.length,
          hasMore: page.hasMore,
          loading: false,
          error: null,
        });
        notify(nodeId);
        onActivity(`fetched ${page.items.length} items`);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        states.set(nodeId, { ...states.get(nodeId)!, loading: false, error: message, hasMore: true });
        notify(nodeId);
        onActivity(`fetch failed: ${message}`);
      });
  };

  return {
    name: "pokemon-data",

    attachRenderer(r) {
      renderer = r;
    },

    getRenderer() {
      return renderer;
    },

    getState(nodeId) {
      return states.get(nodeId);
    },

    async loadMore(nodeId) {
      const node = editor?.getDocument()?.nodes[nodeId];
      if (!node || node.type !== "pokemon-grid") return;
      const current = states.get(nodeId);
      if (!current || current.loading || !current.hasMore) return;

      const limit = Number(node.props.pageSize ?? 8) || 8;
      const offset = current.items.length;
      const loading: PokemonNodeState = { ...current, loading: true };
      states.set(nodeId, loading);
      notify(nodeId);

      try {
        const page = await fetchPokemonPage(offset, limit);
        states.set(nodeId, {
          items: [...current.items, ...page.items],
          offset: offset + page.items.length,
          hasMore: page.hasMore,
          loading: false,
          error: null,
        });
        notify(nodeId);
        onActivity(`fetched ${page.items.length} items`);

        // The only persisted piece of this action: bump the "how far has this
        // reader paged" cursor. Undoable, so Publish captures how far the
        // document was paginated without serializing any item payloads.
        const pageIndex = Number(node.props.page ?? 0) + 1;
        editor?.updateProps(nodeId, { page: pageIndex }, { merge: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        states.set(nodeId, { ...states.get(nodeId)!, loading: false, error: message });
        notify(nodeId);
        onActivity(`fetch failed: ${message}`);
      }
    },

    subscribe(nodeId, cb) {
      let set = listeners.get(nodeId);
      if (!set) {
        set = new Set();
        listeners.set(nodeId, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) listeners.delete(nodeId);
      };
    },

    install(e) {
      editor = e;
    },

    ready(e) {
      // Scan for pokemon nodes that have no cached state yet and fetch them.
      const scan = () => {
        for (const node of Object.values(e.getDocument().nodes)) {
          if (isPokemonNode(node)) requestInitialFetch(node.id);
        }
      };
      // ready() runs at editor init (usually with an empty/fresh document),
      // but it's also the hook for content that already contains pokemon
      // nodes — e.g. right after a "Load from server" round-trip.
      scan();
      unsubscribeNodeCreate = e.events.on("node.create", ({ node }) => {
        if (isPokemonNode(node)) requestInitialFetch(node.id);
      });
      unsubscribeDocumentLoad = e.events.on("document.load", () => scan());
    },

    destroy() {
      unsubscribeNodeCreate?.();
      unsubscribeNodeCreate = null;
      unsubscribeDocumentLoad?.();
      unsubscribeDocumentLoad = null;
      states.clear();
      listeners.clear();
      editor = null;
      renderer = null;
    },
  };
}
