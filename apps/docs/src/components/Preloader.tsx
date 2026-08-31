"use client";

/**
 * Site preloader with a circular-zoom reveal.
 *
 * Renders a dark full-screen layer with the eugine logo that plays while the
 * page loads. After a short hold it hands off to the `.nexus-reveal-overlay`
 * whose growing transparent circle "circular-zooms" in on the page, then
 * unmounts both nodes via React state (never `.remove()` directly — this
 * component lives in the root layout, which persists across client-side
 * navigations, so a node detached outside of React's own commit phase leaves
 * a stale fiber that crashes the next navigation's reconciliation).
 *
 * The visual work is all done in `site-theme.css`; this component only
 * orchestrates the timing and phase transitions.
 */
import { useEffect, useState } from "react";

type Phase = "loading" | "revealing" | "done";

export function Preloader() {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    // Let the logo breathe for a beat, then start the circular reveal.
    if (phase !== "loading") return;
    const revealTimer = setTimeout(() => setPhase("revealing"), 900);
    return () => clearTimeout(revealTimer);
  }, [phase]);

  useEffect(() => {
    // Unmount once the reveal animation has finished (~0.85s).
    if (phase !== "revealing") return;
    const cleanup = setTimeout(() => setPhase("done"), 1100);
    return () => clearTimeout(cleanup);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <>
      <div
        id="nexus-preloader"
        className={`nexus-preloader ${phase === "revealing" ? "nexus-preloader-fading" : ""}`}
        aria-hidden="true"
      >
        <svg
          className="nexus-preloader-logo h-12 w-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="url(#preloader-gradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="preloader-gradient" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
        <span className="nexus-preloader-caption">eugine</span>
      </div>

      {phase === "revealing" ? <div className="nexus-reveal-overlay" aria-hidden="true" /> : null}
    </>
  );
}
