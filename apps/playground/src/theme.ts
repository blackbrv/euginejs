export type Theme = "light" | "dark";

// Same key/value format as next-themes (storageKey default "theme"), which apps/docs uses via
// fumadocs' RootProvider — sharing it keeps the docs site and the playground in sync since both
// are served from the same origin (see apps/docs/next.config.mjs rewrite for "/playground").
const STORAGE_KEY = "theme";
// Matches RootProvider({ theme: { defaultTheme: "dark" } }) in apps/docs/src/app/layout.tsx.
const DEFAULT_THEME: Theme = "dark";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(stored: string | null): Theme {
  if (stored === "light" || stored === "dark") return stored;
  if (stored === "system") return systemPrefersDark() ? "dark" : "light";
  return DEFAULT_THEME;
}

function setThemeAttribute(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme(): Theme {
  const theme = resolveTheme(window.localStorage.getItem(STORAGE_KEY));
  setThemeAttribute(theme);
  return theme;
}

export function applyTheme(theme: Theme): void {
  setThemeAttribute(theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function getTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

// Keeps an already-open playground tab synced when the theme changes in another tab (e.g. docs).
export function onThemeChange(callback: (theme: Theme) => void): void {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    const theme = resolveTheme(e.newValue);
    setThemeAttribute(theme);
    callback(theme);
  });
}
