import type { Editor, EugineDocument, EugineNode, EugineOperation, HistoryEntry } from "eugine";
import { layerName } from "./panels.js";

/**
 * The History panel: a chronological list of every change made to the page,
 * built entirely from `editor.history.getUndoStack()`/`getRedoStack()` — the
 * read-only `HistoryEntry` view core exposes exactly for this. Clicking a row
 * time-travels by calling the real `undo()`/`redo()` the right number of
 * times, so nothing here bypasses History's stack bookkeeping.
 *
 * The timeline is also mirrored into localStorage so it survives a reload.
 * That persisted copy is a *log*, not a replayable stack: commands hold
 * closures and private state and cannot be serialized, so entries from an
 * earlier session render dimmed and inert above a divider. Restoring real
 * cross-reload undo is what `@euginejs/versioning` (document snapshots) is
 * for — deliberately a different concept from in-session undo/redo.
 *
 * Each row also lists what the change actually did ("Heading · content:
 * "Hi" → "Hello""). HistoryEntry deliberately carries only names, so those
 * details come from `history.onCommit()` — the same serializable
 * `EugineOperation[]` a collaboration transport would send — read against
 * the document as it was before and after the transaction.
 */

const STORAGE_KEY = "eugine-playground:history";

/** ponytail: keeps the newest N entries; a long session silently drops the oldest. Raise or move to IndexedDB if 5MB of localStorage ever becomes the limit. */
const MAX_PERSISTED = 200;

/** The serializable slice of a HistoryEntry — everything the panel actually renders. */
interface SavedEntry {
  id: string;
  label: string | undefined;
  commandNames: string[];
  timestamp: number;
  /** Absent in logs saved by older builds of this app. */
  details?: string[];
}

interface SavedHistory {
  /** Chronological: oldest change first, including ones that are currently undone. */
  entries: SavedEntry[];
  /** How many of `entries` were applied (i.e. the undo stack depth) when saved. */
  applied: number;
}

/** Friendly names for the command names core assigns; anything unmapped falls through as-is. */
const COMMAND_LABELS: Record<string, string> = {
  insert: "Insert",
  remove: "Delete",
  move: "Move",
  reorder: "Reorder",
  duplicate: "Duplicate",
  paste: "Paste",
  wrap: "Wrap",
  unwrap: "Unwrap",
  updateProps: "Edit content",
  updateStyles: "Edit style",
  replace: "Replace",
};

function describe(entry: Pick<HistoryEntry, "label" | "commandNames">): string {
  if (entry.label) return entry.label[0]!.toUpperCase() + entry.label.slice(1);
  const names = [...new Set(entry.commandNames)].map((name) => COMMAND_LABELS[name] ?? name);
  return names.join(" + ") || "Change";
}

/** A value as it reads in a detail line: strings quoted, everything clipped short. */
function show(value: unknown): string {
  if (value === undefined) return "(none)";
  const text = typeof value === "string" ? `"${value}"` : JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/** One "key: old → new" line per key that differs between two props/styles maps. */
function diffLines(prefix: string, before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => `${prefix}${key}: ${show(before[key])} → ${show(after[key])}`);
}

/** Everything that differs on one node — a name (layer rename), content props, or styles. */
function nodeChanges(before: EugineNode | undefined, after: EugineNode | undefined): string[] {
  if (!before || !after) return [];
  const name = layerName(after);
  const renamed = layerName(before) !== name ? [`Renamed "${layerName(before)}" → "${name}"`] : [];
  return [
    ...renamed,
    ...diffLines(`${name} · `, before.props, after.props),
    ...diffLines(`${name} · style `, before.styles, after.styles),
  ];
}

function nameOf(node: EugineNode | undefined): string {
  return node ? layerName(node) : "(removed node)";
}

/**
 * Human-readable lines for one operation. Diffs the node itself rather than
 * the operation's patch so the line can show the old value too, which the
 * operation (only ever the new state) doesn't carry.
 */
function describeOperation(op: EugineOperation, before: EugineDocument, after: EugineDocument): string[] {
  switch (op.type) {
    case "insert":
      return [`Added ${nameOf(op.node)} to ${nameOf(after.nodes[op.parentId])}`];
    case "attach": {
      const nested = Object.keys(op.nodes).length - 1;
      return [`Added ${nameOf(op.nodes[op.rootId])}${nested ? ` (+${nested} nested)` : ""} to ${nameOf(after.nodes[op.parentId])}`];
    }
    case "remove": {
      const node = before.nodes[op.id];
      return [`Removed ${nameOf(node)} from ${nameOf(node?.parent ? before.nodes[node.parent] : undefined)}`];
    }
    case "move": {
      const from = before.nodes[before.nodes[op.id]?.parent ?? ""];
      const to = after.nodes[op.parentId];
      const name = nameOf(after.nodes[op.id]);
      if (from?.id === to?.id) {
        const position = (node: EugineNode | undefined) => (node?.children.indexOf(op.id) ?? -1) + 1;
        return [`Moved ${name} within ${nameOf(to)}: position ${position(from)} → ${position(to)}`];
      }
      return [`Moved ${name} from ${nameOf(from)} to ${nameOf(to)}`];
    }
    case "setProps":
    case "setStyles":
    case "replace":
      return nodeChanges(before.nodes[op.id], after.nodes[op.id]);
    case "reorder":
      return [`Reordered the children of ${nameOf(after.nodes[op.parentId])}`];
    case "wrap":
      return [`Wrapped ${nameOf(after.nodes[op.id])} in a ${op.wrapperType}`];
    case "unwrap":
      return [`Unwrapped ${nameOf(before.nodes[op.id])}`];
  }
}

function describeTransaction(operations: readonly EugineOperation[], before: EugineDocument, after: EugineDocument): string[] {
  return [...new Set(operations.flatMap((op) => describeOperation(op, before, after)))];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * The full timeline in document order: applied changes (the undo stack as-is)
 * followed by undone ones. `getRedoStack()` is newest-first — `redo()` takes
 * from its end — so it reverses into chronological order.
 */
function timeline(editor: Editor): { entries: readonly HistoryEntry[]; applied: number } {
  const undoStack = editor.history.getUndoStack();
  const redoStack = editor.history.getRedoStack();
  return { entries: [...undoStack, ...[...redoStack].reverse()], applied: undoStack.length };
}

function loadPersisted(): SavedHistory | undefined {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    // A stale entry from an older build of this app must not crash the panel.
    if (!parsed || typeof parsed !== "object") return undefined;
    const { entries, applied } = parsed as Partial<SavedHistory>;
    if (!Array.isArray(entries) || typeof applied !== "number") return undefined;
    return { entries, applied };
  } catch {
    console.warn("[playground] stored history log is not valid JSON; ignoring it.");
    return undefined;
  }
}

function persist(editor: Editor): void {
  const { entries, applied } = timeline(editor);
  const dropped = Math.max(0, entries.length - MAX_PERSISTED);
  const saved: SavedHistory = {
    entries: entries.slice(dropped).map((entry) => ({
      id: entry.id,
      label: entry.label,
      commandNames: [...entry.commandNames],
      timestamp: entry.timestamp,
      details: details.get(entry.id),
    })),
    applied: Math.max(0, applied - dropped),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

/** The log as it stood when the page last unloaded — read once, never re-read. */
let previousSession = loadPersisted();

/** Detail lines per HistoryEntry.id for this session, filled from history.onCommit(). */
let details = new Map<string, string[]>();

/**
 * The document as of the last settled history move — i.e. what the next
 * committed transaction started from. ponytail: assumes every document change
 * goes through History (true in this app); an `applyRemote()` edit would make
 * the next entry's details include the remote change too. Track
 * `document.change` per origin if a collaboration demo lands here.
 */
let settled: EugineDocument | undefined;

/**
 * Drops the whole log, past sessions included. For `editor.load()`, which
 * clears History outright (in-session undo is ephemeral by design) — keeping
 * the log would leave it describing a page that is no longer open.
 */
export function resetHistoryPanel(editor: Editor, container: HTMLElement): void {
  window.localStorage.removeItem(STORAGE_KEY);
  previousSession = undefined;
  details = new Map();
  settled = editor.getDocument();
  renderHistory(editor, container);
}

type RenderableEntry = Pick<HistoryEntry, "label" | "commandNames" | "timestamp"> & { details?: readonly string[] };

function row(entry: RenderableEntry, applied: boolean, extraClass = ""): HTMLElement {
  const li = document.createElement("li");
  li.className = `eb-history-row${applied ? "" : " eb-history-undone"} ${extraClass}`.trim();
  li.innerHTML = `
    <span class="eb-history-dot"></span>
    <span class="eb-history-label"></span>
    <time class="eb-history-time">${formatTime(entry.timestamp)}</time>
  `;
  li.querySelector(".eb-history-label")!.textContent = describe(entry);
  if (entry.details?.length) {
    const list = document.createElement("ul");
    list.className = "eb-history-details";
    for (const line of entry.details) {
      const item = document.createElement("li");
      item.textContent = line; // document content — never innerHTML
      list.appendChild(item);
    }
    li.appendChild(list);
  }
  return li;
}

/**
 * Jumps the document to the state right after `index` entries of the timeline
 * have been applied, by running real undo()/redo() steps. Each returns false
 * when it can't move (e.g. the next transaction belongs to another client),
 * which stops the loop rather than spinning.
 */
function travelTo(editor: Editor, index: number): void {
  const { applied } = timeline(editor);
  for (let i = applied; i > index; i -= 1) if (!editor.history.undo()) return;
  for (let i = applied; i < index; i += 1) if (!editor.history.redo()) return;
}

export function renderHistory(editor: Editor, container: HTMLElement): void {
  const { entries, applied } = timeline(editor);
  container.replaceChildren();

  const list = document.createElement("ul");
  list.className = "eb-history";

  const hasPast = (previousSession?.entries.length ?? 0) > 0;
  if (previousSession && hasPast) {
    for (const [i, entry] of previousSession.entries.entries()) {
      list.appendChild(row(entry, i < previousSession.applied, "eb-history-past"));
    }
    const divider = document.createElement("li");
    divider.className = "eb-history-divider";
    divider.textContent = "this session";
    list.appendChild(divider);
  }

  if (entries.length === 0 && !hasPast) {
    const empty = document.createElement("p");
    empty.className = "eb-history-empty";
    empty.textContent = "No changes yet — edit the page and every step shows up here.";
    container.appendChild(empty);
    return;
  }

  for (const [i, entry] of entries.entries()) {
    const isApplied = i < applied;
    const li = row({ ...entry, details: details.get(entry.id) }, isApplied);
    li.classList.add("eb-history-live");
    if (i === applied - 1) li.classList.add("eb-history-current");
    li.tabIndex = 0;
    li.title = isApplied ? "Undo back to this change" : "Redo forward to this change";
    // Standard history-panel semantics: clicking a row puts the document in
    // the state that change produced, undoing or redoing as needed to get there.
    const target = i + 1;
    li.addEventListener("click", () => travelTo(editor, target));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        travelTo(editor, target);
      }
    });
    list.appendChild(li);
  }

  container.appendChild(list);
  // Keep the current position visible as the log grows, scrolling the list
  // itself rather than scrollIntoView() — which would drag the whole sidebar.
  const current = list.querySelector<HTMLElement>(".eb-history-current");
  list.scrollTop = current ? current.offsetTop - list.clientHeight / 2 : list.scrollHeight;
}

/**
 * Renders the panel now and on every history move, mirroring the timeline into
 * localStorage as it goes.
 *
 * A new change is rendered from `onCommit` (which fires right after
 * `onChange`, and is the only one carrying the operations); undo/redo/clear
 * have no commit, so `onChange` renders those.
 *
 * Subscribed to `history.onChange` rather than the editor's `document.change`
 * on purpose: the store emits `document.change` from *inside* `execute()`,
 * before History commits the transaction to its stack, so a panel refreshed
 * from there would always be one change behind.
 */
export function initHistoryPanel(editor: Editor, container: HTMLElement, onMove: () => void = () => {}): () => void {
  details = new Map();
  settled = editor.getDocument();
  const refresh = () => {
    persist(editor);
    renderHistory(editor, container);
    onMove();
  };
  renderHistory(editor, container);
  const offCommit = editor.history.onCommit(({ transaction, operations }) => {
    const after = editor.getDocument();
    details.set(transaction.id!, describeTransaction(operations ?? [], settled ?? after, after));
    settled = after;
    refresh();
  });
  const offChange = editor.history.onChange(({ kind }) => {
    if (kind === "execute") return;
    settled = editor.getDocument();
    refresh();
  });
  return () => {
    offCommit();
    offChange();
  };
}
