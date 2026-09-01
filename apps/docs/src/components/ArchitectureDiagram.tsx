"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "fumadocs-ui/provider/base";
import type {
  DiagramDefinition,
  DiagramEdge,
  DiagramNode,
  DiagramNodeKind,
  DiagramRoute,
} from "@/diagrams/types";

interface DiagramNodeData extends Record<string, unknown> {
  node: DiagramNode;
  dimmed: boolean;
  highlighted: boolean;
}

type DiagramReactNode = Node<DiagramNodeData, "diagram">;

// Real hues, not just grayscale border weight — these double as the legend swatches below.
const NODE_STYLES: Record<DiagramNodeKind | "process", { className: string; swatch: string }> = {
  start: { className: "border-emerald-500 dark:border-emerald-400", swatch: "bg-emerald-500 dark:bg-emerald-400" },
  process: { className: "border-fd-border", swatch: "bg-fd-muted-foreground" },
  fork: { className: "border-amber-500 dark:border-amber-400", swatch: "bg-amber-500 dark:bg-amber-400" },
  end: { className: "border-sky-500 dark:border-sky-400", swatch: "bg-sky-500 dark:bg-sky-400" },
  error: { className: "border-red-500 dark:border-red-400", swatch: "bg-red-500 dark:bg-red-400" },
};

const KIND_LABELS: Record<DiagramNodeKind | "process", string> = {
  start: "Start",
  process: "Step",
  fork: "Branch point",
  end: "Outcome",
  error: "Error / failure path",
};

// Handles are real (not just visual) — every edge needs one to attach to, or React Flow
// silently drops it (logs "Couldn't create edge for source handle id: null"). Hidden via
// opacity since diagrams here are read-only (nodesConnectable is false).
function DiagramNodeComponent({ data, selected }: NodeProps<DiagramReactNode>) {
  const { node, dimmed, highlighted } = data;
  const kindStyle = NODE_STYLES[node.kind ?? "process"] ?? NODE_STYLES.process;
  return (
    <div
      className={[
        "node-card min-w-[180px] max-w-[260px] rounded-lg border-2 bg-fd-card px-4 py-2.5 shadow-sm transition-opacity duration-150",
        kindStyle.className,
        dimmed ? "opacity-40" : "",
        highlighted ? "ring-2 ring-fd-primary" : "",
        selected ? "ring-2 ring-fd-accent" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="text-center text-[13px] font-medium leading-snug text-fd-foreground">
        {node.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { diagram: DiagramNodeComponent };

export interface ArchitectureDiagramProps {
  data: DiagramDefinition;
  title?: string;
}

const nodeLabel = (data: DiagramDefinition, id: string): string =>
  data.nodes.find((n) => n.id === id)?.label ?? id;

function edgeLabel(data: DiagramDefinition, e: DiagramEdge): string {
  if (e.label) return `${e.label}`;
  return `${nodeLabel(data, e.from)} → ${nodeLabel(data, e.to)}`;
}

export function ArchitectureDiagram({ data, title }: ArchitectureDiagramProps) {
  const { resolvedTheme } = useTheme();
  // resolvedTheme is undefined on the server and on the very first client render (it
  // resolves from localStorage/cookies after mount), so computing isDark from it directly
  // bakes a light-mode style into the SSR HTML while the client immediately wants dark —
  // a hydration mismatch React then refuses to repaint, leaving the diagram stuck light.
  // Rendering a fixed default (matching the site's own defaultTheme) until mounted keeps
  // server and first-client-render identical; the real theme applies on the next paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  const focusedNode = useMemo(
    () => data.nodes.find((n) => n.id === focusedNodeId) ?? null,
    [data.nodes, focusedNodeId],
  );

  const activeRoute: DiagramRoute | undefined = useMemo(
    () => data.routes?.find((r) => r.id === activeRouteId) ?? undefined,
    [data.routes, activeRouteId],
  );

  // A node or edge is "dimmed" when a focus or route is active and it is not part
  // of that focus/route. Everything else is fully opaque.
  const nodes: DiagramReactNode[] = useMemo(() => {
    const routeNodeIds = activeRoute ? new Set(activeRoute.nodeIds) : null;
    return data.nodes.map((n) => {
      const inRoute = routeNodeIds ? routeNodeIds.has(n.id) : true;
      const isFocusTarget = focusedNodeId === n.id;
      const focusMode = focusedNodeId !== null && !isFocusTarget;
      const dimmed = (routeNodeIds !== null && !inRoute) || focusMode;
      return {
        id: n.id,
        type: "diagram",
        position: { x: n.x, y: n.y },
        data: { node: n, dimmed, highlighted: isFocusTarget || (routeNodeIds !== null && inRoute) },
      };
    });
  }, [data.nodes, focusedNodeId, activeRoute]);

  const edges: Edge[] = useMemo(() => {
    const routeEdgeIds = activeRoute ? new Set(activeRoute.edgeIds) : null;
    const focusedEdges = focusedNodeId
      ? new Set(data.edges.filter((e) => e.from === focusedNodeId || e.to === focusedNodeId).map((e) => e.id))
      : null;
    return data.edges.map((e) => {
      const inRoute = routeEdgeIds ? routeEdgeIds.has(e.id) : true;
      const inFocus = focusedEdges ? focusedEdges.has(e.id) : true;
      const dimmed = (routeEdgeIds !== null && !inRoute) || (focusedEdges !== null && !inFocus);
      const urgent = !dimmed && (routeEdgeIds !== null || focusedEdges !== null);
      const hasLabel = e.label != null || e.order != null;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label ?? (e.order != null ? String(e.order) : undefined),
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: urgent ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
        },
        style: {
          stroke: urgent ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
          strokeWidth: urgent ? 2.5 : 1.5,
          opacity: dimmed ? 0.25 : 1,
        },
        labelStyle: hasLabel ? { fill: "var(--color-fd-foreground)", fontSize: 11, fontWeight: 500 } : undefined,
        labelBgStyle: hasLabel ? { fill: "var(--color-fd-card)", fillOpacity: 0.95 } : undefined,
        labelBgPadding: hasLabel ? ([4, 2] as [number, number]) : undefined,
      };
    });
  }, [data.edges, activeRoute, focusedNodeId]);

  // Only show legend entries for kinds this particular diagram actually uses.
  const usedKinds = useMemo(() => {
    const kinds = new Set<DiagramNodeKind | "process">();
    for (const n of data.nodes) kinds.add(n.kind ?? "process");
    const order: (DiagramNodeKind | "process")[] = ["start", "process", "fork", "end", "error"];
    return order.filter((k) => kinds.has(k));
  }, [data.nodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: DiagramReactNode) => {
    setFocusedNodeId((current) => (current === node.id ? null : node.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setFocusedNodeId(null);
    setActiveRouteId(null);
  }, []);

  return (
    <div className="not-prose my-6">
      {title ? <h3 className="mb-3 text-base font-semibold text-fd-foreground">{title}</h3> : null}

      {data.routes && data.routes.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveRouteId(null)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeRouteId === null
                ? "border-fd-accent bg-fd-accent text-fd-accent-foreground"
                : "border-fd-border bg-fd-card text-fd-muted-foreground hover:border-fd-accent hover:text-fd-foreground",
            ].join(" ")}
          >
            Show all
          </button>
          {data.routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => setActiveRouteId((current) => (current === route.id ? null : route.id))}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeRouteId === route.id
                  ? "border-fd-accent bg-fd-accent text-fd-accent-foreground"
                  : "border-fd-border bg-fd-card text-fd-muted-foreground hover:border-fd-accent hover:text-fd-foreground",
              ].join(" ")}
            >
              {route.label}
            </button>
          ))}
        </div>
      ) : null}

      {usedKinds.length > 1 ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fd-muted-foreground">
          {usedKinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={["h-2 w-2 rounded-full", NODE_STYLES[k].swatch].join(" ")} />
              {KIND_LABELS[k]}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-lg border border-fd-border"
        style={{
          height: 460,
          ["--xy-background-color" as string]: isDark ? "#020202" : "#ffffff",
          ["--xy-node-background-color" as string]: "var(--color-fd-card)",
          ["--xy-edge-stroke" as string]: "var(--color-fd-border)",
          ["--xy-controls-button-background-color" as string]: "var(--color-fd-card)",
          ["--xy-controls-button-border-color" as string]: "var(--color-fd-border)",
          ["--xy-controls-button-text-color" as string]: "var(--color-fd-foreground)",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: false }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          zoomOnDoubleClick={false}
          minZoom={0.4}
          maxZoom={2}
          colorMode={isDark ? "dark" : "light"}
        >
          <Background color={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} gap={24} />
          <Controls />
        </ReactFlow>
      </div>

      {focusedNode ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-fd-border bg-fd-muted/40 px-4 py-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-fd-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div className="text-xs text-fd-muted-foreground">
            <span className="mb-1 block font-medium text-fd-foreground">{focusedNode.label}</span>
            {focusedNode.description}
          </div>
        </div>
      ) : null}

      <details className="mt-3 rounded-lg border border-fd-border bg-fd-muted/40 px-4 py-3 text-xs text-fd-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-fd-foreground">
          Text version of this diagram
        </summary>
        <ul className="mt-3 space-y-1.5">
          {data.nodes.map((n) => (
            <li key={n.id}>
              <span className="font-medium text-fd-foreground">{n.label}</span>
              {n.description ? <span> — {n.description}</span> : null}
              {n.kind ? <span className="text-fd-muted-foreground"> ({n.kind})</span> : null}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 border-t border-fd-border pt-3">
          {data.edges.map((e) => (
            <li key={e.id}>
              <span>
                {edgeLabel(data, e)}: {nodeLabel(data, e.from)} → {nodeLabel(data, e.to)}
              </span>
            </li>
          ))}
        </ul>
        {data.routes && data.routes.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-fd-border pt-3">
            {data.routes.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-fd-foreground">{r.label}</span>
                <span> — path through {r.nodeIds.join(" → ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </div>
  );
}