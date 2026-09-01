export type DiagramNodeKind = "start" | "process" | "fork" | "end" | "error";

export interface DiagramNode<Id extends string = string> {
  id: Id;
  label: string;
  /** Shown when the node is clicked, and in the accessibility fallback table. */
  description?: string;
  /** Hand-authored position — no auto-layout dependency. */
  x: number;
  y: number;
  kind?: DiagramNodeKind;
}

export interface DiagramEdge<Id extends string = string> {
  id: string;
  from: Id;
  to: Id;
  label?: string;
  /** For sequence-style diagrams (e.g. events.mdx) where edges are numbered. */
  order?: number;
}

export interface DiagramRoute<Id extends string = string> {
  id: string;
  /** Button text, e.g. "Undo — rollback on throw". */
  label: string;
  nodeIds: Id[];
  edgeIds: string[];
}

export interface DiagramDefinition<Id extends string = string> {
  nodes: DiagramNode<Id>[];
  edges: DiagramEdge<Id>[];
  routes?: DiagramRoute<Id>[];
}
