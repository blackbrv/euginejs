/** Arbitrary JSON-serializable value. Eugine never assumes a specific shape for props/styles. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type NodeProps = Record<string, unknown>;
export type NodeStyles = Record<string, unknown>;

/**
 * A single node in the document tree. Nodes are stored flat (by id) inside
 * an EugineDocument rather than nested, so structural updates touch only the
 * affected entries instead of the whole tree.
 */
export interface EugineNode {
  id: string;
  type: string;
  props: NodeProps;
  styles?: NodeStyles;
  className?: string;
  children: string[];
  parent: string | null;
  metadata?: Record<string, unknown>;
  customData?: Record<string, unknown>;
  /** Cannot be deleted, moved, or have its type changed by editor commands. */
  locked?: boolean;
  /** Content within this node may be edited in-place (e.g. CMS slots). Defaults to true. */
  editable?: boolean;
  /** Excluded from rendering output but retained in the document. */
  hidden?: boolean;
}

/** The root schema version this build of @eugine/core understands natively. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The document model: a flat map of nodes plus the id of the root node.
 * This is the persisted, renderer-independent source of truth described in
 * the PRD — it must never contain editor-only state (selection, viewport, ...).
 */
export interface EugineDocument {
  schemaVersion: number;
  rootId: string;
  nodes: Record<string, EugineNode>;
}

/** The canonical, versioned, on-disk/over-the-wire representation of a document. */
export interface SerializedDocument {
  schemaVersion: number;
  engine: "eugine";
  engineVersion: string;
  document: EugineDocument;
}

export type DropAcceptRule = "*" | "none" | string[];

export interface ComponentPropDefinition {
  name: string;
  label?: string;
  type?: string;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Declarative description of a component type. This is the security boundary
 * described in the PRD: renderers resolve a node's `type` against a
 * registered ComponentDefinition instead of dynamically importing/executing
 * anything named inside untrusted document JSON.
 */
export interface ComponentDefinition<TRender = unknown> {
  type: string;
  label?: string;
  category?: string;
  description?: string;
  defaults?: {
    props?: NodeProps;
    styles?: NodeStyles;
  };
  /** Which child component types this component may contain. */
  accepts?: DropAcceptRule;
  maxChildren?: number;
  /** Editable property metadata, used by developer-built property panels. */
  props?: ComponentPropDefinition[];
  /** Opaque to core — a React component, a render function, a tag name, etc. */
  render?: TRender;
  isCanvas?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Disposable {
  (): void;
}
