"use client";

/**
 * Applies scroll-reveal to a rendered MDX docs page.
 *
 * Wraps the docs body and, once mounted, tags the structural elements
 * (headings, callouts, tables) with `.nexus-reveal` so they fade up as the
 * reader scrolls. The classes are added only under JS + IntersectionObserver,
 * so server-rendered HTML (and robots/AI scrapers) always see the full,
 * visible content.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function DocsReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const targets = root.querySelectorAll<HTMLElement>(
      "h2, h3, blockquote, table, .not-prose",
    );
    targets.forEach((el) => el.classList.add("nexus-reveal"));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("nexus-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
