"use client";

/**
 * Site preloader with a circular-zoom reveal.
 *
 * Renders a full-screen black layer with the eugine logo that plays while
 * the page loads. After a short hold it hands off to the
 * `.nexus-reveal-overlay` whose growing transparent circle
 * "circular-zooms" in on the page, then
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
        <img src="/eugine-logo.png" alt="Eugine" className="nexus-preloader-logo h-24 w-24" />
      </div>

      {phase === "revealing" ? <div className="nexus-reveal-overlay" aria-hidden="true" /> : null}
    </>
  );
}
