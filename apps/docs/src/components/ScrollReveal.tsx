"use client";

/**
 * Scroll-reveal animation.
 *
 * Wraps children in an element that fades/slides in when scrolled into view.
 * Uses IntersectionObserver so it adds `.nexus-revealed` at the right moment;
 * everything visual (the transition, the reduced-motion fallback) lives in
 * `site-theme.css`. Works across the landing page and the Fumadocs docs pages.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    // Only start hidden once we're sure you can reveal it — with JS off the
    // content stays fully visible (important for SSR/robots, which never
    // receive this class at all).
    el.classList.add("nexus-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("nexus-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
