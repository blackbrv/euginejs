"use client";

/**
 * Landing page for eugine's documentation site.
 *
 * Recreates the futuristic "spotlight + animated beams" aesthetic: a fixed
 * layered background (pulsed grid, blurred indigo/purple gradients, noise), a
 * sticky blurred nav with a CMD+K command palette, a floating 3D hero panel
 * with animated SVG beams, mouse-tracking spotlight cards, a live workflow
 * visualizer, and a package table.
 *
 * Colors are drawn from the same `fd-*` design tokens the docs pages use
 * (see `site-theme.css`), so light/dark here is the same theme as the rest
 * of the site, not a separate dark-only skin — toggling the theme switch
 * on any docs page repaints this page identically. A few saturated accent
 * colors (the workflow graph's node colors, the headline shimmer) are
 * explicit `dark:` pairs instead, since they're deliberately more vivid in
 * dark mode than a plain semantic token would give them.
 *
 * The markup is kept semantically meaningful (real <nav>/<section>/<h1..h3>,
 * descriptive headings, real link hrefs) so AI agents can scrape the page and
 * understand what eugine is and how to navigate it without following its
 * visual chrome. Everything interactive lives behind the same rules an editor
 * host would use: local state for the spotlight + modal + slider.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { ScrollReveal } from "@/components/ScrollReveal";
import {
  ArrowRight,
  BarChart2,
  Book,
  Bot,
  Check,
  Command,
  Database,
  Layers,
  LayoutTemplate,
  Menu,
  MoreHorizontal,
  MousePointer2,
  Palette,
  PhoneCall,
  PlusCircle,
  Search,
  Send,
  Sparkles,
  Terminal,
  Users,
  Webhook,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnthropicMark, AWSMark, OpenAIMark, VercelMark } from "./icons";

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 rounded border border-fd-border bg-fd-muted px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground">
      {children}
    </kbd>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-fd-primary/20 bg-fd-accent px-3 py-1 text-xs font-medium text-fd-accent-foreground">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

/** A lucide icon inside a glowing container (services grid). */
function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div
      className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border border-fd-border bg-fd-card transition-transform duration-300 group-hover:scale-110 ${className ?? ""}`}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

interface NavLinkItem {
  href: string;
  label: string;
}

// /playground is a separate static SPA served via a rewrite (see
// next.config.mjs), not an App Router page — next/link's soft navigation
// assumes a page in this app's route tree, so it gets a plain <a> (full
// page load) instead of everything else here.
function NavLink({
  link,
  className,
  onClick,
}: {
  link: NavLinkItem;
  className: string;
  onClick?: () => void;
}) {
  if (link.href === "/playground") {
    return (
      <a href={link.href} className={className} onClick={onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <Link
      href={link.href}
      className={className}
      prefetch={link.href.startsWith("/docs") ? false : undefined}
      onClick={onClick}
    >
      {link.label}
    </Link>
  );
}

function Nav({ onSearch }: { onSearch: () => void }) {
  const links: NavLinkItem[] = [
    { href: "#features", label: "Features" },
    { href: "#workflow", label: "Workflow" },
    { href: "#packages", label: "Packages" },
    { href: "/docs", label: "Docs" },
    { href: "/playground", label: "Playground" },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="fixed top-0 z-50 w-full border-b border-fd-border bg-fd-background/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a href="#hero" className="group flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-fd-muted transition-colors group-hover:bg-gradient-to-tr group-hover:from-indigo-600/20 group-hover:to-purple-600/20">
            <Layers className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">eugine</span>
        </a>

        <ul className="hidden items-center gap-6 text-sm text-fd-muted-foreground md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink link={link} className="transition-colors hover:text-fd-foreground" />
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <button
            type="button"
            onClick={onSearch}
            className="flex items-center gap-2 rounded-lg border border-fd-border bg-fd-muted px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:border-fd-primary/30 hover:text-fd-foreground"
            aria-label="Open search and command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <Kbd>
              <Command className="h-2.5 w-2.5" />K
            </Kbd>
          </button>
          {/* Hidden below md: at that width the hamburger toggle takes over
              navigation (including to /docs) and there isn't room for both
              in the header without overflowing. */}
          <Link
            href="/docs"
            className="hidden items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900 md:inline-flex"
          >
            Read docs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center justify-center rounded-lg border border-fd-border bg-fd-muted p-2 text-fd-muted-foreground transition-colors hover:border-fd-primary/30 hover:text-fd-foreground md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div
          id="mobile-nav-panel"
          className="border-t border-fd-border bg-fd-background/95 backdrop-blur-md md:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm text-fd-muted-foreground sm:px-6">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink
                  link={link}
                  className="block rounded-lg px-2 py-2 transition-colors hover:bg-fd-muted hover:text-fd-foreground"
                  onClick={() => setMenuOpen(false)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Command palette (search modal)                                      */
/* ------------------------------------------------------------------ */

interface SearchIndexEntry {
  label: string;
  href: string;
  keywords: string;
}

function SearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const index: SearchIndexEntry[] = [
    { label: "Introduction", href: "/docs", keywords: "overview getting started engine builder" },
    { label: "Guides — First editor", href: "/docs/guides/first-editor", keywords: "create editor insert register component" },
    { label: "Guides — Rendering", href: "/docs/reference-guides/rendering", keywords: "render in server html" },
    { label: "API Reference — core", href: "/docs/api/core", keywords: "editor document commands history serialize" },
    { label: "Packages", href: "#packages", keywords: "eugine core renderer server versioning install" },
    { label: "Workflow", href: "#workflow", keywords: "command history execution log" },
    { label: "Features", href: "#features", keywords: "registry renderer serialization plugin versioning" },
  ];

  const results = query.trim()
    ? index.filter(
        (entry) =>
          entry.label.toLowerCase().includes(query.toLowerCase()) ||
          entry.keywords.toLowerCase().includes(query.toLowerCase()),
      )
    : index;

  return (
    <div
      id="search-modal"
      className={`fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh] ${open ? "" : "invisible"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`nexus-modal relative w-full max-w-lg overflow-hidden rounded-2xl border border-fd-border bg-fd-popover/95 shadow-2xl ${open ? "nexus-modal-open" : ""}`}
      >
        <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
          <Search className="h-4 w-4 text-fd-muted-foreground" />
          <input
            ref={inputRef}
            id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                onSelect();
                window.location.href = results[0].href;
              }
            }}
            placeholder="Search the docs… or press ESC to close"
            className="w-full bg-transparent text-sm text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.map((entry) => (
            <li key={entry.label}>
              <a
                href={entry.href}
                onClick={onSelect}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
              >
                <span className="flex items-center gap-2">
                  <Book className="h-4 w-4 text-fd-muted-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                  {entry.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-fd-muted-foreground">No results for “{query}”.</li>
          ) : null}
        </ul>
        <div className="flex items-center gap-3 border-t border-fd-border px-4 py-2 text-[10px] text-fd-muted-foreground">
          <span>
            <Kbd>Enter</Kbd> open
          </span>
          <span>
            <Kbd>ESC</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

const GRAPH_NODES = [
  { id: "WEBHOOK_EVENT", label: "WEBHOOK_EVENT", x: 90, y: 90, color: "text-emerald-600 dark:text-emerald-400", icon: Zap },
  { id: "INTELLIGENCE", label: "INTELLIGENCE", x: 300, y: 160, color: "text-indigo-600 dark:text-indigo-400", icon: Sparkles },
  { id: "STORE", label: "STORE", x: 120, y: 280, color: "text-purple-600 dark:text-purple-400", icon: Database },
  { id: "ACTION", label: "ACTION", x: 330, y: 300, color: "text-amber-600 dark:text-amber-400", icon: Send },
] as const;

const GRAPH_BEAMS = [
  { d: "M120,95 C120,130 220,80 300,160", className: "stroke-indigo-500", delay: "0s" },
  { d: "M300,195 C260,220 180,220 150,280", className: "stroke-purple-500", delay: "0.7s" },
  { d: "M300,195 C300,230 330,240 330,285", className: "stroke-emerald-500", delay: "1.3s" },
] as const;

function HeroGraph() {
  return (
    <div className="nexus-perspective-1000 relative">
      <div className="nexus-animate-float relative rounded-2xl border border-fd-border bg-fd-card/60 p-6 shadow-[0_0_60px_-15px_rgba(99,102,241,0.4)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-fd-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            <span className="font-mono">eugine · automation graph</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            live
          </span>
        </div>

        {/* overflow-auto + the inner min-w below let the canvas scroll in
            either direction within this card on narrow screens/heights,
            instead of the absolutely-positioned nodes (up to x=330, y=300)
            forcing the whole page to scroll — same pattern as the packages
            table further down. The panel itself also shrinks at small
            breakpoints to leave room for the rest of the mobile viewport;
            overflow-auto (not overflow-y-hidden) keeps that shrink from
            clipping the graph — it scrolls instead. */}
        <div className="relative mt-4 h-[220px] w-full overflow-auto rounded-xl border border-fd-border bg-fd-muted sm:h-[260px] md:h-[300px] lg:h-[340px]">
          <div className="relative h-full min-w-[420px]">
            {/* internal grid */}
            <div className="nexus-panel-grid absolute inset-0 opacity-40" />
            {/* beams layer */}
            <svg className="absolute inset-0 z-0 h-full w-full" aria-hidden="true">
              {GRAPH_BEAMS.map((beam) => (
                <path
                  key={beam.d}
                  d={beam.d}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className={`nexus-animate-beam ${beam.className}`}
                  style={{ animationDelay: beam.delay }}
                />
              ))}
            </svg>
            {/* nodes layer */}
            <div className="absolute inset-0 z-10">
              {GRAPH_NODES.map((node) => (
                <div
                  key={node.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: node.x, top: node.y }}
                >
                  <div
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg border border-fd-border bg-fd-card/90 px-3 py-1.5 text-xs backdrop-blur-sm ${node.color}`}
                  >
                    <node.icon className="h-3.5 w-3.5" />
                    <span className="font-mono">{node.label}</span>
                  </div>
                </div>
              ))}
              {/* collaborator cursor */}
              <div
                className="absolute z-20"
                style={{ top: 180, left: 300 }}
                aria-hidden="true"
              >
                <div className="flex flex-col gap-1">
                  <MousePointer2 className="h-5 w-5 text-pink-400" />
                  <span className="ml-4 rounded bg-pink-500/90 px-1.5 py-0.5 text-[10px] text-white">
                    collaborator
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* progress bar with the exact reference animation */}
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-[10px] text-fd-muted-foreground">render commit</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fd-muted">
            <div className="nexus-animate-width h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
          </div>
          <span className="font-mono text-[10px] text-fd-muted-foreground">100%</span>
        </div>
      </div>
    </div>
  );
}

const TOOL_LOGOS = [
  { name: "OpenAI", Icon: OpenAIMark },
  { name: "Anthropic", Icon: AnthropicMark },
  { name: "AWS", Icon: AWSMark },
  { name: "Vercel", Icon: VercelMark },
];

function Hero() {
  return (
    <section id="hero" className="relative mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 sm:pt-36">
      <ScrollReveal>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
          <Badge>
            <Sparkles className="h-3 w-3" />
            An engine, not a builder
          </Badge>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Build visual editors
            <br />
            <span className="nexus-animate-shimmer bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400">
              at the speed of thought.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-fd-muted-foreground">
            the document model, component registry, command/history system, and rendering layer
            behind drag-and-drop editors — so you ship the editor, not the plumbing.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_-5px_rgba(0,0,0,0.25)] transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
            >
              Read the documentation <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#workflow"
              className="inline-flex items-center gap-2 rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:border-fd-primary/30"
            >
              See how it works
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-xl border border-fd-border bg-fd-muted px-4 py-3 font-mono text-sm text-fd-muted-foreground">
            <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>
              <span className="text-fd-foreground">$</span> npm install eugine
            </span>
            <MoreHorizontal className="ml-auto h-4 w-4 text-fd-muted-foreground" />
          </div>

          {/* Logo cloud */}
          <p className="mt-10 text-xs uppercase tracking-wider text-fd-muted-foreground">
            Renders anywhere your stack does
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-6 opacity-60 grayscale transition-all hover:grayscale-0">
            {TOOL_LOGOS.map(({ name, Icon }) => (
              <span key={name} className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                <Icon className="h-5 w-5" />
                {name}
              </span>
            ))}
          </div>
        </div>

        <HeroGraph />
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Services / features — mouse-tracking spotlight cards                */
/* ------------------------------------------------------------------ */

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  mono?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: "Flat document model",
    body: "One shape — { schemaVersion, rootId, nodes } — purely JSON-serializable, with no editor state mixed in.",
    mono: "EugineDocument",
  },
  {
    icon: Webhook,
    title: "Component registry",
    body: "Node types resolve strictly against a registry you build. A document names a type, never code to run.",
    mono: "ComponentRegistry",
  },
  {
    icon: Terminal,
    title: "Commands & history",
    body: "Every edit is a command with execute()/undo(). A drag becomes exactly one undo step via transaction().",
    mono: "History",
  },
  {
    icon: LayoutTemplate,
    title: "Two renderers, one document",
    body: "Incremental DOM renderer in the browser, deterministic HTML string renderer on the server.",
    mono: "renderer · server",
  },
  {
    icon: Database,
    title: "Serialization & versioning",
    body: "Versioned envelopes, schema migration, and an optional plugin for durable document versions and rollback.",
    mono: "SerializedDocument",
  },
  {
    icon: Users,
    title: "Collaboration-ready",
    body: "Operations serialize for remote apply, with undo scoped per client and revision-bumped saves.",
    mono: "applyRemote()",
  },
];

function SpotlightCard({ feature }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <article
      ref={ref}
      onMouseMove={onMove}
      className="nexus-spotlight-card group flex flex-col gap-4 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between">
        <IconTile icon={feature.icon} />
        {feature.mono ? (
          <span className="rounded-md border border-fd-border bg-fd-muted px-2 py-1 font-mono text-[10px] text-fd-muted-foreground">
            {feature.mono}
          </span>
        ) : null}
      </div>
      <h3 className="text-lg font-semibold">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-fd-muted-foreground">{feature.body}</p>
    </article>
  );
}

function Services() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <ScrollReveal>
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything your editor needs, none of what the users see.
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Six building blocks, each one a separate, swappable surface. Hosts compose these into a
            builder without carrying the engine’s internal policy.
          </p>
        </div>
      </ScrollReveal>
      <div id="cards-container" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <SpotlightCard key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow visualizer — parameter controls + live execution log       */
/* ------------------------------------------------------------------ */

const WORKFLOW_STEPS = [
  { tag: "validate", text: "drop rules checked against ComponentRegistry", ok: true },
  { tag: "command", text: "InsertNodeCommand.execute(store)", ok: true },
  { tag: "history", text: "transaction committed · 1 undo step", ok: true },
  { tag: "store", text: "document.replace() · nodes updated", ok: true },
  { tag: "event", text: "document.change → renderer.update()", ok: true },
  { tag: "remote", text: "operation serialized for other clients", ok: false },
];

function Workflow() {
  const [magnitude, setMagnitude] = useState(2);
  const [simulate, setSimulate] = useState(true);
  const [trace, setTrace] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!simulate) return;
    const id = setInterval(() => setStep((s) => (s + 1) % (WORKFLOW_STEPS.length + 1)), 700);
    return () => clearInterval(id);
  }, [simulate]);

  const json = JSON.stringify(
    {
      type: "insert",
      parentId: "root",
      index: magnitude,
      commit: { undo: true, trace },
    },
    null,
    2,
  );

  return (
    <section id="workflow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <ScrollReveal>
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">Workflow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            One edit, end to end.
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Watch a single operation pass through the pipeline every editor action runs: validation,
            command, history, store, render, and the serialized remote op.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Parameter controls */}
        <div className="rounded-2xl border border-fd-border bg-fd-card p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
            <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Parameter controls
          </h3>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-fd-muted-foreground">Nesting depth</span>
              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-300">{magnitude}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={magnitude}
              onChange={(e) => setMagnitude(Number(e.target.value))}
              className="nexus-slider mt-3"
              aria-label="Nesting depth"
            />
            <p className="mt-2 text-xs text-fd-muted-foreground">
              Depth is capped to protect recursive renderers from stack overflow (DoS guard).
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center justify-between text-sm text-fd-foreground">
              <span>Run simulation</span>
              <input
                type="checkbox"
                checked={simulate}
                onChange={(e) => setSimulate(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-fd-foreground">
              <span>Emit operation trace</span>
              <input
                type="checkbox"
                checked={trace}
                onChange={(e) => setTrace(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
          </div>

          <pre className="mt-6 select-none overflow-x-auto rounded-xl border border-fd-border bg-fd-muted p-4 font-mono text-xs leading-relaxed text-fd-foreground">
            <code>{json}</code>
          </pre>
        </div>

        {/* Live execution log */}
        <div className="rounded-2xl border border-fd-border bg-fd-card p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Live execution log
          </h3>
          <div className="mt-4 h-72 overflow-x-auto overflow-y-hidden rounded-xl border border-fd-border bg-fd-muted p-4 font-mono text-xs leading-relaxed">
            {WORKFLOW_STEPS.map((stepItem, i) => {
              const active = simulate && i < step;
              return (
                <div
                  key={stepItem.tag}
                  className={`flex gap-3 whitespace-nowrap transition-opacity ${active ? "opacity-100" : "opacity-30"}`}
                >
                  <span
                    className={`w-16 shrink-0 uppercase ${
                      stepItem.ok ? "text-emerald-600 dark:text-emerald-400" : "text-fd-muted-foreground"
                    }`}
                  >
                    {stepItem.tag}
                  </span>
                  <span className="text-fd-foreground">{stepItem.text}</span>
                </div>
              );
            })}
            {simulate ? (
              <div className="mt-1 flex gap-3">
                <span className="w-16 shrink-0 text-fd-muted-foreground">&nbsp;</span>
                <span className="nexus-caret inline-block h-4 w-2 bg-fd-foreground/50" aria-hidden="true" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Packages table (keeps the "comparison table" visual, relevant data) */
/* ------------------------------------------------------------------ */

const PACKAGE_ROWS = [
  {
    name: "eugine",
    file: "eugine",
    blurb: "All-in-one: core + renderer + server + versioning.",
    recommended: true,
  },
  {
    name: "@euginejs/core",
    file: "@euginejs/core",
    blurb: "Document model, registry, commands, history, serialization.",
    recommended: false,
  },
  {
    name: "@euginejs/renderer",
    file: "@euginejs/renderer",
    blurb: "Browser DOM renderer, per-node incremental updates.",
    recommended: false,
  },
  {
    name: "@euginejs/renderer-server",
    file: "@euginejs/renderer-server",
    blurb: "Deterministic HTML string renderer, zero browser APIs.",
    recommended: false,
  },
  {
    name: "@euginejs/versioning",
    file: "@euginejs/versioning",
    blurb: "Optional plugin for durable versions and rollback.",
    recommended: false,
  },
];

function Packages() {
  return (
    <section id="packages" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <ScrollReveal>
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">Packages</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Five packages, one engine.
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Install <span className="font-mono text-fd-foreground">eugine</span> for everything, or each{" "}
            <span className="font-mono text-fd-foreground">@euginejs/*</span> package on its own. The
            engine is the dependency; the rendering and versioning surfaces are separate deployment
            targets.
          </p>
        </div>
      </ScrollReveal>

      <div className="overflow-x-auto rounded-2xl border border-fd-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-fd-border text-fd-muted-foreground">
              <th scope="col" className="px-6 py-4 font-medium">
                Package
              </th>
              <th scope="col" className="px-6 py-4 font-medium">
                What it gives you
              </th>
              <th scope="col" className="px-6 py-4 font-medium">
                Install target
              </th>
            </tr>
          </thead>
          <tbody>
            {PACKAGE_ROWS.map((row) => (
              <tr
                key={row.name}
                className="border-b border-fd-border/60 transition-colors last:border-0 hover:bg-fd-muted"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={row.recommended ? "font-semibold text-fd-accent-foreground" : ""}>
                      {row.name}
                    </span>
                    {row.recommended ? (
                      <Badge>
                        <Check className="h-3 w-3" /> Recommended
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4 text-fd-muted-foreground">{row.blurb}</td>
                <td className="px-6 py-4">
                  <span className="rounded-lg border border-fd-border bg-fd-muted px-3 py-1.5 font-mono text-xs text-fd-foreground">
                    npm i {row.file}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer + about/contact anchors                                      */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-fd-border">
      {/* Empty anchor targets, matching the source page's structure. */}
      <div id="about" />
      <div id="contact" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <a href="#hero" className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-fd-muted">
                <Layers className="h-4 w-4" />
              </span>
              <span className="font-semibold tracking-tight">eugine</span>
            </a>
            <p className="mt-4 max-w-sm text-sm text-fd-muted-foreground">
              An engine for building drag-and-drop visual editors and page builders — MIT licensed,
              framework-agnostic, and server-safe.
            </p>
          </div>

          <nav aria-label="Documentation" className="space-y-3 text-sm">
            <p className="text-xs uppercase tracking-wider text-fd-muted-foreground">Documentation</p>
            <Link href="/docs" className="block text-fd-muted-foreground transition-colors hover:text-fd-foreground">
              Introduction
            </Link>
            <Link href="/docs/api/core" className="block text-fd-muted-foreground transition-colors hover:text-fd-foreground">
              API reference
            </Link>
            <Link href="#workflow" className="block text-fd-muted-foreground transition-colors hover:text-fd-foreground">
              Workflow
            </Link>
          </nav>

          <nav aria-label="Project" className="space-y-3 text-sm">
            <p className="text-xs uppercase tracking-wider text-fd-muted-foreground">Project</p>
            <a
              href="https://github.com/blackbrv/euginejs"
              target="_blank"
              rel="noreferrer"
              className="block text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              GitHub
            </a>
            <a href="#packages" className="block text-fd-muted-foreground transition-colors hover:text-fd-foreground">
              Packages
            </a>
            <span className="block text-fd-muted-foreground">MIT license</span>
          </nav>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-fd-border pt-6 text-xs text-fd-muted-foreground">
          <span>© {new Date().getFullYear()} eugine — MIT licensed.</span>
          <span className="flex items-center gap-3">
            <BarChart2 className="h-3.5 w-3.5" />
            <Palette className="h-3.5 w-3.5" />
            <Users className="h-3.5 w-3.5" />
            <PhoneCall className="h-3.5 w-3.5" />
            <PlusCircle className="h-3.5 w-3.5" />
            <X className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage({ fontClass = "" }: { fontClass?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

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
      className={`nexus-landing ${fontClass} relative min-h-screen bg-fd-background font-[Inter,ui-sans-serif,system-ui,sans-serif] text-fd-foreground antialiased`}
    >
      {/* Background layer stack */}
      <div className="nexus-bg" aria-hidden="true">
        <div className="nexus-grid" />
        <div className="nexus-blob-indigo" />
        <div className="nexus-blob-purple" />
        <div className="nexus-noise" />
      </div>

      <Nav onSearch={() => setSearchOpen(true)} />

      <main id="main-body" className="relative">
        <Hero />
        <Services />
        <Workflow />
        <Packages />
      </main>

      <Footer />

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={() => setSearchOpen(false)} />
    </div>
  );
}
