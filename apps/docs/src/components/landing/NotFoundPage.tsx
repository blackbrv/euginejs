"use client";

/**
 * 404 page for the docs site.
 *
 * Deliberately reuses `Nav`/`SearchModal`/`Footer`/`Badge` from `LandingPage`
 * (same background layer stack, same `fd-*` tokens, same shimmer-heading and
 * pill-button styles as the Hero section) so this reads as one more page of
 * the same site rather than a bolted-on error screen. It's the boundary Next
 * renders for any unmatched route, and for `notFound()` calls from
 * `app/docs/[[...slug]]/page.tsx` (missing doc pages) since there's no more
 * specific `not-found.tsx` under `app/docs/`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, Terminal } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Badge, Footer, Nav, SearchModal } from "./LandingPage";

export default function NotFoundPage({ fontClass = "" }: { fontClass?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the body scroll locked while the modal is open.
  useEffect(() => {
    document.body.style.overflow = searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [searchOpen]);

  return (
    <div
      className={`nexus-landing ${fontClass} relative flex min-h-screen flex-col bg-fd-background font-[Inter,ui-sans-serif,system-ui,sans-serif] text-fd-foreground antialiased`}
    >
      {/* Background layer stack */}
      <div className="nexus-bg" aria-hidden="true">
        <div className="nexus-grid" />
        <div className="nexus-blob-indigo" />
        <div className="nexus-blob-purple" />
        <div className="nexus-noise" />
      </div>

      <Nav onSearch={() => setSearchOpen(true)} />

      <main id="main-body" className="relative flex flex-1 items-center">
        <section className="mx-auto min-w-0 max-w-3xl px-4 pt-28 pb-20 text-center sm:px-6 sm:pt-36">
          <ScrollReveal>
            <Badge>
              <Compass className="h-3 w-3" />
              404 — page not found
            </Badge>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              This node
              <br />
              <span className="nexus-animate-shimmer bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400">
                isn't registered.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-fd-muted-foreground">
              The page you're looking for doesn't exist, moved, or was never registered. Check the
              URL, or find your way from here.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_-5px_rgba(0,0,0,0.25)] transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
              >
                Read the documentation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:border-fd-primary/30"
              >
                Back to home
              </Link>
            </div>

            <div className="mx-auto mt-10 flex max-w-md items-center gap-3 rounded-xl border border-fd-border bg-fd-muted px-4 py-3 font-mono text-sm text-fd-muted-foreground">
              <Terminal className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span className="min-w-0 truncate">
                <span className="text-fd-foreground">$</span> registry.get("{pathname}") → undefined
              </span>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={() => setSearchOpen(false)}
      />
    </div>
  );
}
