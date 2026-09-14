/**
 * Recent Node versions define their own (unavailable, experimental)
 * `localStorage` on globalThis, which vitest's jsdom environment then declines
 * to overwrite — so `window.localStorage` comes out undefined here even though
 * it is perfectly ordinary in a real browser. A Map-backed stand-in is enough
 * for these tests and keeps the app code free of environment sniffing.
 */
if (!window.localStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}
