import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eugine — Kitchen Sink example",
  description: "A comprehensive Next.js example exercising every MVP feature in eugine.",
};

// Sets data-theme synchronously, before first paint, so switching to dark
// mode never flashes a light frame first — mirrors apps/playground/index.html's
// inline script. Kept as a string (not a JSX event handler) because it must
// run in the initial server-rendered HTML, before React hydrates.
const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("eugine-kitchen-sink:theme");
    var theme = stored === "light" || stored === "dark" ? stored : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
