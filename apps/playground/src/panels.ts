import { getAncestors, getNode, type Editor, type EugineNode } from "eugine";
import { CARET_ICON, componentIcon } from "./componentIcons.js";
import { schemaFor } from "./schema.js";
import { DEFAULT_LENGTH_UNITS, DESIGN_FIELDS, DESIGN_GROUPS, isCustomStyleProperty, parseLength, type DesignFieldDef } from "./styleFields.js";

/** Applies a style directly to the live canvas element, bypassing the editor/history entirely. */
export type PreviewStyle = (id: string, property: string, value: string) => void;

/**
 * Which layer rows are collapsed, keyed by node id. Module-level (not part
 * of the document/editor state) because this is purely a view preference —
 * collapsing a row in the Layers panel doesn't change your page.
 */
const collapsedIds = new Set<string>();

export function renderLayers(
  editor: Editor,
  container: HTMLElement,
  onSelect: (id: string, additive: boolean) => void,
  onContextMenu: (id: string, clientX: number, clientY: number) => void,
): void {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "eb-layers";
  const document_ = editor.getDocument();
  const selectedIds = editor.selection.get();
  const selected = new Set(selectedIds);

  // A selected node should always be visible, even if a collapsed ancestor
  // would otherwise hide it — expand its whole ancestor chain.
  for (const id of selectedIds) {
    if (!document_.nodes[id]) continue;
    for (const ancestor of getAncestors(document_, id)) collapsedIds.delete(ancestor.id);
  }

  const renderRow = (id: string, depth: number): void => {
    const node = getNode(document_, id);
    const hasChildren = node.children.length > 0;
    const expanded = !collapsedIds.has(id);

    const item = document.createElement("li");
    item.className = "eb-layer-row";
    if (selected.has(node.id)) item.classList.add("eb-layer-selected");

    const main = document.createElement("div");
    main.className = "eb-layer-row-main";
    main.style.paddingLeft = `${depth * 14}px`;
    main.addEventListener("click", (event) => onSelect(node.id, event.shiftKey));
    main.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onContextMenu(node.id, event.clientX, event.clientY);
    });

    const caret = document.createElement("button");
    caret.type = "button";
    caret.className = "eb-layer-caret";
    if (hasChildren) {
      caret.innerHTML = `<svg class="eb-icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${CARET_ICON}</svg>`;
      caret.classList.toggle("eb-layer-caret-expanded", expanded);
      caret.title = expanded ? "Collapse" : "Expand";
      caret.addEventListener("click", (event) => {
        event.stopPropagation();
        if (collapsedIds.has(id)) collapsedIds.delete(id);
        else collapsedIds.add(id);
        renderLayers(editor, container, onSelect, onContextMenu);
      });
    } else {
      caret.classList.add("eb-layer-caret-empty");
      caret.disabled = true;
      caret.tabIndex = -1;
    }
    main.appendChild(caret);

    const iconEl = document.createElement("span");
    iconEl.className = "eb-layer-icon";
    iconEl.innerHTML = componentIcon(node.type);
    main.appendChild(iconEl);

    const label = document.createElement("span");
    label.className = "eb-layer-label";
    label.textContent = node.type;
    main.appendChild(label);

    item.appendChild(main);

    if (node.id !== document_.rootId) {
      const actions = document.createElement("span");
      actions.className = "eb-layer-actions";

      const dup = document.createElement("button");
      dup.textContent = "⧉";
      dup.title = "Duplicate";
      dup.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(editor.duplicate(node.id), false);
      });

      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = "Delete";
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        editor.remove(node.id);
      });

      actions.append(dup, del);
      item.appendChild(actions);
    }

    list.appendChild(item);

    if (hasChildren && expanded) {
      for (const childId of node.children) renderRow(childId, depth + 1);
    }
  };

  renderRow(document_.rootId, 0);
  container.appendChild(list);
}

export function renderInspector(editor: Editor, container: HTMLElement, previewStyle: PreviewStyle): void {
  container.innerHTML = "";
  const selectedIds = editor.selection.get();
  if (selectedIds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "eb-inspector-empty";
    empty.textContent = "Select a component to edit its properties.";
    container.appendChild(empty);
    return;
  }
  if (selectedIds.length > 1) {
    const note = document.createElement("p");
    note.className = "eb-inspector-empty";
    note.textContent = `${selectedIds.length} components selected. Select just one to edit its properties and design.`;
    container.appendChild(note);
    return;
  }

  const node = getNode(editor.getDocument(), selectedIds[0]!);
  const schema = schemaFor(node.type);

  const heading = document.createElement("h3");
  heading.textContent = `${node.type} (${node.id})`;
  container.appendChild(heading);

  if (schema && schema.fields.length > 0) {
    for (const field of schema.fields) {
      const row = document.createElement("label");
      row.className = "eb-field";

      const labelEl = document.createElement("span");
      labelEl.textContent = field.label;
      row.appendChild(labelEl);

      const input = document.createElement("input");
      input.type = "text";
      input.value = String(node.props[field.name] ?? "");
      input.addEventListener("change", () => {
        editor.updateProps(node.id, { [field.name]: input.value });
      });
      row.appendChild(input);

      container.appendChild(row);
    }
  } else {
    const note = document.createElement("p");
    note.className = "eb-inspector-empty";
    note.textContent = "This component has no editable properties.";
    container.appendChild(note);
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

function renderDesignHeading(container: HTMLElement, text: string): void {
  const h3 = document.createElement("h3");
  h3.textContent = text;
  container.appendChild(h3);
}

function renderDesignField(
  container: HTMLElement,
  editor: Editor,
  node: EugineNode,
  field: DesignFieldDef,
  previewStyle: PreviewStyle,
): void {
  const row = document.createElement("label");
  row.className = field.control === "color" ? "eb-field eb-field-color" : "eb-field";

  const labelEl = document.createElement("span");
  labelEl.textContent = field.label;
  row.appendChild(labelEl);

  const value = currentStyle(node, field.property);

  if (field.control === "select") {
    const select = document.createElement("select");
    select.className = "eb-select";
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
    group.className = "eb-color-input-group";

    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "eb-color-swatch";
    swatch.value = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";

    const text = document.createElement("input");
    text.type = "text";
    text.className = "eb-color-text";
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
    group.className = "eb-length-input-group";

    const units = field.units ?? DEFAULT_LENGTH_UNITS;
    const parsed = parseLength(value);
    // A value with a unit we don't list (rare hand-edited data) still needs
    // somewhere to show up — prepend it rather than silently discarding it.
    const unitOptions = parsed && !units.includes(parsed.unit) && parsed.unit ? [parsed.unit, ...units] : units;

    const amount = document.createElement("input");
    amount.type = "number";
    amount.step = "any";
    amount.className = "eb-length-amount";
    amount.value = parsed?.amount ?? "";

    const unit = document.createElement("select");
    unit.className = "eb-length-unit";
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

function renderCustomStyleRow(
  container: HTMLElement,
  editor: Editor,
  node: EugineNode,
  initialProperty: string,
  initialValue: string,
): void {
  const row = document.createElement("div");
  row.className = "eb-custom-style-row";

  const propInput = document.createElement("input");
  propInput.type = "text";
  propInput.placeholder = "property";
  propInput.value = initialProperty;
  propInput.className = "eb-custom-style-prop";

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "value";
  valueInput.value = initialValue;
  valueInput.className = "eb-custom-style-value";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "eb-custom-style-remove";
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

function fieldDependencyMet(node: EugineNode, field: DesignFieldDef): boolean {
  if (!field.dependsOn) return true;
  const actual = currentStyle(node, field.dependsOn.property);
  const expected = field.dependsOn.value;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function renderDesignSection(
  editor: Editor,
  node: EugineNode,
  container: HTMLElement,
  previewStyle: PreviewStyle,
): void {
  renderDesignHeading(container, "Design");

  // Layout (display/flex/grid) only affects how *children* are arranged,
  // so it's meaningless — and hidden — for components that can't have any.
  const canHaveChildren = editor.registry.tryGet(node.type)?.accepts !== "none";

  for (const group of DESIGN_GROUPS) {
    if (group === "Layout" && !canHaveChildren) continue;
    const fields = DESIGN_FIELDS.filter((f) => f.group === group && fieldDependencyMet(node, f));
    if (fields.length === 0) continue;
    const groupEl = document.createElement("div");
    groupEl.className = "eb-design-group";

    const groupHeading = document.createElement("h4");
    groupHeading.textContent = group;
    groupEl.appendChild(groupHeading);

    for (const field of fields) renderDesignField(groupEl, editor, node, field, previewStyle);
    container.appendChild(groupEl);
  }

  const customGroup = document.createElement("div");
  customGroup.className = "eb-design-group";
  const customHeading = document.createElement("h4");
  customHeading.textContent = "Custom CSS";
  customGroup.appendChild(customHeading);

  const customHint = document.createElement("p");
  customHint.className = "eb-inspector-hint";
  customHint.textContent = "Any CSS property Eugine doesn't have a dedicated control for.";
  customGroup.appendChild(customHint);

  const customEntries = Object.entries(node.styles ?? {}).filter(([property, value]) => isCustomStyleProperty(property) && value !== undefined);
  for (const [property, value] of customEntries) {
    renderCustomStyleRow(customGroup, editor, node, property, String(value ?? ""));
  }
  // Always-present blank row so there's a permanent place to add the next property.
  renderCustomStyleRow(customGroup, editor, node, "", "");

  container.appendChild(customGroup);
}
