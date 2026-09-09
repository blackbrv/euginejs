import { getNode, getParent, isAncestor, walk, type Editor, type EugineNode } from "eugine";
import { getDropPosition, type DropPosition } from "eugine/renderer";
import { icon } from "./icons";
import { schemaFor } from "./schema";
import {
  DEFAULT_LENGTH_UNITS,
  DESIGN_FIELDS,
  DESIGN_GROUPS,
  formatGridTrackCount,
  isCustomStyleProperty,
  parseGridTrackCount,
  parseLength,
  type DesignFieldDef,
} from "./styleFields";

/** Applies a style directly to the live canvas element, bypassing the editor/history entirely. */
export type PreviewStyle = (id: string, property: string, value: string) => void;

/** Icon shown next to each design-panel group heading — purely decorative, keyed by DESIGN_GROUPS' names. */
const DESIGN_GROUP_ICONS: Record<(typeof DESIGN_GROUPS)[number], Parameters<typeof icon>[0]> = {
  Layout: "layout",
  Size: "resize",
  Image: "image",
  Background: "droplet",
  Typography: "type",
  Border: "square",
  Spacing: "maximize",
  Effects: "zap",
  Animation: "play",
};

/**
 * Which design-panel groups are collapsed, by group name. Module-level (a
 * view preference, not document state) — mirrors playground's
 * `collapsedDesignGroups`. Starts with every group collapsed, so selecting a
 * node doesn't dump its entire style surface into view at once — the user
 * opens only the group they actually want to touch.
 */
const collapsedDesignGroups = new Set<string>([...DESIGN_GROUPS, "Custom CSS"]);

/** Id of the layer row currently being dragged, or null when no drag is in progress. Mirrors apps/playground's panels.ts. */
let draggingId: string | null = null;
let dropMarkerRow: HTMLElement | null = null;
let dropMarkerPosition: DropPosition | null = null;

function clearDropMarker(): void {
  dropMarkerRow?.classList.remove("ks-layer-drop-before", "ks-layer-drop-after", "ks-layer-drop-inside");
  dropMarkerRow = null;
  dropMarkerPosition = null;
}

function setDropMarker(row: HTMLElement, position: DropPosition): void {
  if (dropMarkerRow && dropMarkerRow !== row) clearDropMarker();
  row.classList.remove("ks-layer-drop-before", "ks-layer-drop-after", "ks-layer-drop-inside");
  row.classList.add(`ks-layer-drop-${position}`);
  dropMarkerRow = row;
  dropMarkerPosition = position;
}

// dragend always fires on the drag source even when the drop was cancelled
// (released off-window, Escape, ...), so it's the safe place to clear state.
document.addEventListener("dragend", () => {
  clearDropMarker();
  draggingId = null;
});

/** The Photoshop-style display name for a layer row: its custom name if renamed, else its type. */
function layerName(node: EugineNode): string {
  const name = node.metadata?.name;
  return typeof name === "string" && name.trim() ? name : node.type;
}

/** Whether dropping `draggedId` at `position` relative to `targetId` would be a legal move. */
function canDropLayer(editor: Editor, draggedId: string, targetId: string, position: DropPosition): boolean {
  if (draggedId === targetId) return false;
  const document_ = editor.getDocument();
  const draggedNode = getNode(document_, draggedId);
  if (draggedNode.locked || isAncestor(document_, draggedId, targetId)) return false;

  const parent = position === "inside" ? getNode(document_, targetId) : getParent(document_, targetId);
  if (!parent) return false; // "before"/"after" on the root: it has no parent to reorder within

  const currentChildCount = parent.id === draggedNode.parent ? parent.children.length - 1 : parent.children.length;
  return editor.registry.canAcceptChild({ parentType: parent.type, childType: draggedNode.type, currentChildCount });
}

/** Where `draggedId` should land — assumes canDropLayer() already passed. */
function resolveDrop(editor: Editor, draggedId: string, targetId: string, position: DropPosition): { parentId: string; index?: number } {
  if (position === "inside") return { parentId: targetId };
  const parent = getParent(editor.getDocument(), targetId)!;
  const siblings = parent.children.filter((id) => id !== draggedId);
  const at = siblings.indexOf(targetId);
  return { parentId: parent.id, index: position === "after" ? at + 1 : at };
}

/**
 * Double-click-to-rename, Photoshop-style. Mirrors apps/playground's
 * makeLayerNameEditable and canvas.ts's makeEditableText — same reason for
 * toggling `row.draggable` off mid-edit (so selecting text doesn't start a
 * native drag).
 */
function makeLayerNameEditable(nameEl: HTMLElement, node: EugineNode, editor: Editor, row: HTMLElement): void {
  const stopEditing = (commit: boolean) => {
    if (nameEl.contentEditable !== "true") return;
    nameEl.contentEditable = "false";
    row.draggable = !node.locked && node.id !== editor.getDocument().rootId;
    nameEl.classList.remove("ks-layer-name-editing");
    if (commit) {
      const value = (nameEl.textContent ?? "").trim();
      if (value !== layerName(node)) {
        const metadata = { ...node.metadata };
        if (value) metadata.name = value;
        else delete metadata.name;
        editor.replace(node.id, { ...node, metadata });
        return;
      }
    }
    nameEl.textContent = layerName(node);
  };

  nameEl.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    nameEl.contentEditable = "true";
    row.draggable = false;
    nameEl.classList.add("ks-layer-name-editing");
    nameEl.focus();
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });

  nameEl.addEventListener("blur", () => stopEditing(true));
  nameEl.addEventListener("keydown", (event) => {
    if (nameEl.contentEditable !== "true") return;
    if (event.key === "Enter") {
      event.preventDefault();
      nameEl.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopEditing(false);
      nameEl.blur();
    }
  });
}

export function renderLayers(
  editor: Editor,
  container: HTMLElement,
  onSelect: (id: string, additive: boolean) => void,
  onContextMenu: (id: string, clientX: number, clientY: number) => void,
): void {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "ks-layers";
  const document_ = editor.getDocument();
  const selected = new Set(editor.selection.get());

  walk(document_, (node, depth) => {
    const item = document.createElement("li");
    item.className = "ks-layer-row";
    item.style.paddingLeft = `${depth * 14}px`;
    if (selected.has(node.id)) item.classList.add("ks-layer-selected");

    const label = document.createElement("span");
    label.className = "ks-layer-label";
    label.addEventListener("click", (event) => onSelect(node.id, event.shiftKey));
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onContextMenu(node.id, event.clientX, event.clientY);
    });

    const nameEl = document.createElement("span");
    nameEl.className = "ks-layer-name";
    nameEl.textContent = layerName(node);
    label.appendChild(nameEl);
    makeLayerNameEditable(nameEl, node, editor, item);

    if (node.locked || node.hidden) {
      const flags = document.createElement("span");
      flags.className = "ks-layer-flags";
      flags.textContent = `${node.locked ? " 🔒" : ""}${node.hidden ? " 🙈" : ""}`;
      label.appendChild(flags);
    }

    item.appendChild(label);

    const isRoot = node.id === document_.rootId;
    item.draggable = !isRoot && !node.locked;
    item.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      draggingId = node.id;
      event.dataTransfer?.setData("text/plain", node.id);
      event.dataTransfer!.effectAllowed = "move";
      item.classList.add("ks-layer-dragging");
    });
    item.addEventListener("dragend", () => item.classList.remove("ks-layer-dragging"));

    item.addEventListener("dragover", (event) => {
      if (!draggingId) return;
      const acceptsChildren = editor.registry.tryGet(node.type)?.accepts !== "none";
      const position: DropPosition = isRoot
        ? "inside"
        : getDropPosition(
            item.getBoundingClientRect(),
            { clientX: event.clientX, clientY: event.clientY },
            { insideRatio: acceptsChildren ? 0.5 : 0 },
          );

      if (!canDropLayer(editor, draggingId, node.id, position)) {
        if (dropMarkerRow === item) clearDropMarker();
        return;
      }
      event.preventDefault();
      event.dataTransfer!.dropEffect = "move";
      setDropMarker(item, position);
    });

    item.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) return;
      if (dropMarkerRow === item) clearDropMarker();
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const sourceId = draggingId;
      const position = dropMarkerRow === item ? dropMarkerPosition : null;
      clearDropMarker();
      draggingId = null;
      if (!sourceId || !position) return;
      try {
        const { parentId, index } = resolveDrop(editor, sourceId, node.id, position);
        editor.move(sourceId, parentId, index);
      } catch (error) {
        console.warn("[kitchen-sink] layer move rejected:", error);
      }
    });

    if (node.id !== document_.rootId) {
      const actions = document.createElement("span");
      actions.className = "ks-layer-actions";

      const lockBtn = document.createElement("button");
      lockBtn.textContent = node.locked ? "Unlock" : "Lock";
      lockBtn.title = "Toggle locked (locked nodes cannot be moved or deleted)";
      lockBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        editor.replace(node.id, { ...node, locked: !node.locked });
      });

      const hideBtn = document.createElement("button");
      hideBtn.textContent = node.hidden ? "Show" : "Hide";
      hideBtn.title = "Toggle hidden (hidden nodes are excluded from rendered output)";
      hideBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        editor.replace(node.id, { ...node, hidden: !node.hidden });
      });

      const dup = document.createElement("button");
      dup.textContent = "Dup";
      dup.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(editor.duplicate(node.id), false);
      });

      const del = document.createElement("button");
      del.textContent = "✕";
      del.disabled = Boolean(node.locked);
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        editor.remove(node.id);
      });

      actions.append(lockBtn, hideBtn, dup, del);
      item.appendChild(actions);
    }

    list.appendChild(item);
  });

  container.appendChild(list);
}

export function renderInspector(editor: Editor, container: HTMLElement, previewStyle: PreviewStyle): void {
  container.innerHTML = "";
  const selected = editor.selection.get();

  if (selected.length === 0) {
    container.innerHTML = `<p class="ks-empty">Select a component. Shift-click to multi-select.</p>`;
    return;
  }
  if (selected.length > 1) {
    container.innerHTML = `<p class="ks-empty">${selected.length} components selected.</p>`;
    const delAll = document.createElement("button");
    delAll.textContent = "Delete selected";
    delAll.addEventListener("click", () => {
      // One editor.transaction() = one undo step for the whole batch, even
      // though it internally issues N separate remove() commands.
      editor.transaction(() => {
        for (const id of selected) {
          if (!editor.getDocument().nodes[id]) continue; // may already be gone (e.g. a removed descendant)
          editor.remove(id);
        }
      });
    });
    container.appendChild(delAll);
    return;
  }

  const node = getNode(editor.getDocument(), selected[0]!);
  const schema = schemaFor(node.type);

  const heading = document.createElement("h3");
  heading.textContent = `${node.type} (${node.id})`;
  container.appendChild(heading);

  if (node.id !== editor.getDocument().rootId) {
    const wrapBtn = document.createElement("button");
    wrapBtn.textContent = "Wrap in container";
    wrapBtn.addEventListener("click", () => editor.wrap(node.id, "container"));
    container.appendChild(wrapBtn);

    if (node.children.length > 0) {
      const unwrapBtn = document.createElement("button");
      unwrapBtn.textContent = "Unwrap";
      unwrapBtn.addEventListener("click", () => editor.unwrap(node.id));
      container.appendChild(unwrapBtn);
    }
  }

  if (!schema || schema.fields.length === 0) {
    const note = document.createElement("p");
    note.className = "ks-empty";
    note.textContent = "This component has no editable properties.";
    container.appendChild(note);
  } else {
    for (const field of schema.fields) {
      const row = document.createElement("label");
      row.className = "ks-field";
      const labelEl = document.createElement("span");
      labelEl.textContent = field.label;
      row.appendChild(labelEl);

      const input = document.createElement("input");
      input.type = field.type ?? "text";
      input.value = String(node.props[field.name] ?? "");
      input.addEventListener("change", () => editor.updateProps(node.id, { [field.name]: input.value }));
      row.appendChild(input);

      container.appendChild(row);
    }
  }

  renderDesignSection(editor, node, container, previewStyle);
}

function currentStyle(node: EugineNode, property: string): string {
  const value = node.styles?.[property];
  return value === undefined || value === null ? "" : String(value);
}

function setStyle(editor: Editor, node: EugineNode, property: string, value: string): void {
  editor.updateStyles(node.id, { [property]: value });
}

function fieldDependencyMet(node: EugineNode, field: DesignFieldDef): boolean {
  if (field.onlyForTypes && !field.onlyForTypes.includes(node.type)) return false;
  if (!field.dependsOn) return true;
  const actual = currentStyle(node, field.dependsOn.property);
  const expected = field.dependsOn.value;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function renderDesignField(container: HTMLElement, editor: Editor, node: EugineNode, field: DesignFieldDef, previewStyle: PreviewStyle): void {
  const row = document.createElement("label");
  row.className = field.control === "color" ? "ks-field ks-field-color" : "ks-field";

  const labelEl = document.createElement("span");
  labelEl.textContent = field.label;
  row.appendChild(labelEl);

  const value = currentStyle(node, field.property);

  if (field.control === "select") {
    const select = document.createElement("select");
    select.className = "ks-select";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Default";
    select.appendChild(defaultOption);
    for (const optionValue of field.options ?? []) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      if (optionValue === value) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener("change", () => setStyle(editor, node, field.property, select.value));
    row.appendChild(select);
  } else if (field.control === "color") {
    const group = document.createElement("div");
    group.className = "ks-color-input-group";

    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "ks-color-swatch";
    swatch.value = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";

    const text = document.createElement("input");
    text.type = "text";
    text.className = "ks-color-text";
    text.placeholder = "e.g. #fff, red, rgba(0,0,0,.4)";
    text.value = value;

    // Native color pickers fire `input` continuously while the user drags
    // the picker's cursor, and only fire `change` once when they're done.
    // Committing on every `input` tick (via editor.updateStyles) triggers a
    // full inspector re-render that destroys/recreates this <input>,
    // closing the native picker mid-drag — so `input` only live-previews
    // directly on the canvas element, and `change` does the real commit.
    swatch.addEventListener("input", () => {
      text.value = swatch.value;
      previewStyle(node.id, field.property, swatch.value);
    });
    swatch.addEventListener("change", () => {
      setStyle(editor, node, field.property, swatch.value);
    });
    text.addEventListener("input", () => {
      previewStyle(node.id, field.property, text.value);
    });
    text.addEventListener("change", () => {
      setStyle(editor, node, field.property, text.value);
      if (/^#[0-9a-f]{6}$/i.test(text.value)) swatch.value = text.value;
    });

    group.append(swatch, text);
    row.appendChild(group);
  } else if (field.control === "length") {
    const group = document.createElement("div");
    group.className = "ks-length-input-group";

    const units = field.units ?? DEFAULT_LENGTH_UNITS;
    const parsed = parseLength(value);
    // A value with a unit we don't list (rare hand-edited data) still needs
    // somewhere to show up — prepend it rather than silently discarding it.
    const unitOptions = parsed && !units.includes(parsed.unit) && parsed.unit ? [parsed.unit, ...units] : units;

    const amount = document.createElement("input");
    amount.type = "number";
    amount.step = "any";
    amount.className = "ks-length-amount";
    amount.value = parsed?.amount ?? "";

    const unit = document.createElement("select");
    unit.className = "ks-length-unit";
    for (const u of unitOptions) {
      const option = document.createElement("option");
      option.value = u;
      option.textContent = u;
      unit.appendChild(option);
    }
    unit.value = parsed?.unit || unitOptions[0]!;

    // A bare number with no unit (e.g. "40") is an invalid CSS length and is
    // silently ignored by the browser — pairing the amount with an explicit
    // unit dropdown means the user never has to type (or remember) one.
    const combined = () => {
      const trimmed = amount.value.trim();
      return trimmed === "" ? "" : `${trimmed}${unit.value}`;
    };

    amount.addEventListener("input", () => {
      const v = combined();
      if (v) previewStyle(node.id, field.property, v);
    });
    amount.addEventListener("change", () => setStyle(editor, node, field.property, combined()));
    unit.addEventListener("change", () => {
      if (amount.value.trim() !== "") setStyle(editor, node, field.property, combined());
    });

    group.append(amount, unit);
    row.appendChild(group);
  } else if (field.control === "grid-tracks") {
    const group = document.createElement("div");
    group.className = "ks-grid-tracks-group";

    const count = document.createElement("input");
    count.type = "number";
    count.min = "0";
    count.step = "1";
    count.placeholder = "Auto";
    count.className = "ks-grid-tracks-count";
    const parsedCount = parseGridTrackCount(value);
    count.value = parsedCount > 0 ? String(parsedCount) : "";

    const suffix = document.createElement("span");
    suffix.className = "ks-grid-tracks-suffix";
    suffix.textContent = "equal tracks";

    count.addEventListener("change", () => {
      const n = Math.max(0, Math.round(Number(count.value) || 0));
      setStyle(editor, node, field.property, formatGridTrackCount(n));
    });

    group.append(count, suffix);
    row.appendChild(group);
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = field.placeholder ?? "";
    input.value = value;
    input.addEventListener("change", () => setStyle(editor, node, field.property, input.value));
    row.appendChild(input);
  }

  container.appendChild(row);
}

function renderCustomStyleRow(container: HTMLElement, editor: Editor, node: EugineNode, initialProperty: string, initialValue: string): void {
  const row = document.createElement("div");
  row.className = "ks-custom-style-row";

  const propInput = document.createElement("input");
  propInput.type = "text";
  propInput.placeholder = "property";
  propInput.value = initialProperty;
  propInput.className = "ks-custom-style-prop";

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "value";
  valueInput.value = initialValue;
  valueInput.className = "ks-custom-style-value";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "ks-custom-style-remove";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove";
  removeBtn.hidden = !initialProperty;

  const commit = () => {
    const property = propInput.value.trim();
    if (!property) return;
    const updates: Record<string, unknown> = {};
    if (initialProperty && initialProperty !== property) updates[initialProperty] = undefined;
    updates[property] = valueInput.value;
    editor.updateStyles(node.id, updates);
  };

  propInput.addEventListener("change", commit);
  valueInput.addEventListener("change", commit);
  removeBtn.addEventListener("click", () => {
    if (initialProperty) editor.updateStyles(node.id, { [initialProperty]: undefined });
  });

  row.append(propInput, valueInput, removeBtn);
  container.appendChild(row);
}

/**
 * A collapsible design-panel group: an icon + label header button (toggles
 * `collapsedDesignGroups`) and a body the caller fills with fields. Toggling
 * mutates the DOM directly rather than triggering a full renderInspector()
 * re-render, so it doesn't blow away in-progress input focus elsewhere in
 * the panel. Mirrors apps/playground/src/panels.ts's createDesignGroup.
 */
function createDesignGroup(container: HTMLElement, name: string, iconName: Parameters<typeof icon>[0]): HTMLElement {
  const groupEl = document.createElement("div");
  groupEl.className = "ks-design-group";

  const collapsed = collapsedDesignGroups.has(name);

  const header = document.createElement("button");
  header.type = "button";
  header.className = "ks-design-group-header";
  if (collapsed) header.classList.add("ks-design-group-collapsed");
  header.setAttribute("aria-expanded", String(!collapsed));
  header.innerHTML = `${icon(iconName)}<span class="ks-design-group-title">${name}</span>${icon("chevron", "ks-icon ks-design-group-chevron")}`;
  groupEl.appendChild(header);

  const body = document.createElement("div");
  body.className = "ks-design-group-body";
  body.hidden = collapsed;
  groupEl.appendChild(body);

  header.addEventListener("click", () => {
    const nowCollapsed = !body.hidden;
    body.hidden = nowCollapsed;
    header.setAttribute("aria-expanded", String(!nowCollapsed));
    header.classList.toggle("ks-design-group-collapsed", nowCollapsed);
    if (nowCollapsed) collapsedDesignGroups.add(name);
    else collapsedDesignGroups.delete(name);
  });

  container.appendChild(groupEl);
  return body;
}

function renderDesignSection(editor: Editor, node: EugineNode, container: HTMLElement, previewStyle: PreviewStyle): void {
  const heading = document.createElement("h3");
  heading.textContent = "Design";
  container.appendChild(heading);

  // Layout (display/flex/grid) only affects how *children* are arranged, so
  // it's meaningless — and hidden — for components that can't have any.
  const canHaveChildren = editor.registry.tryGet(node.type)?.accepts !== "none";

  for (const group of DESIGN_GROUPS) {
    if (group === "Layout" && !canHaveChildren) continue;
    const fields = DESIGN_FIELDS.filter((f) => f.group === group && fieldDependencyMet(node, f));
    if (fields.length === 0) continue;
    const body = createDesignGroup(container, group, DESIGN_GROUP_ICONS[group]);
    for (const field of fields) renderDesignField(body, editor, node, field, previewStyle);
  }

  const customBody = createDesignGroup(container, "Custom CSS", "code");

  const customEntries = Object.entries(node.styles ?? {}).filter(([property, value]) => isCustomStyleProperty(property) && value !== undefined);
  for (const [property, value] of customEntries) {
    renderCustomStyleRow(customBody, editor, node, property, String(value ?? ""));
  }
  // Always-present blank row so there's a permanent place to add the next property.
  renderCustomStyleRow(customBody, editor, node, "", "");
}

export function renderEventLog(entries: string[], container: HTMLElement): void {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "ks-event-log";
  for (const entry of entries.slice(-30).reverse()) {
    const li = document.createElement("li");
    li.textContent = entry;
    list.appendChild(li);
  }
  container.appendChild(list);
}
