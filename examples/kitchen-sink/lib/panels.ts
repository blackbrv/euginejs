import { getNode, walk, type Editor, type EugineNode } from "eugine";
import { schemaFor } from "./schema";
import { DEFAULT_LENGTH_UNITS, DESIGN_FIELDS, DESIGN_GROUPS, isCustomStyleProperty, parseLength, type DesignFieldDef } from "./styleFields";

/** Applies a style directly to the live canvas element, bypassing the editor/history entirely. */
export type PreviewStyle = (id: string, property: string, value: string) => void;

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
    label.textContent = node.type + (node.locked ? " 🔒" : "") + (node.hidden ? " 🙈" : "");
    label.addEventListener("click", (event) => onSelect(node.id, event.shiftKey));
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onContextMenu(node.id, event.clientX, event.clientY);
    });
    item.appendChild(label);

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
      input.type = "text";
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
    const groupEl = document.createElement("div");
    groupEl.className = "ks-design-group";

    const groupHeading = document.createElement("h4");
    groupHeading.textContent = group;
    groupEl.appendChild(groupHeading);

    for (const field of fields) renderDesignField(groupEl, editor, node, field, previewStyle);
    container.appendChild(groupEl);
  }

  const customGroup = document.createElement("div");
  customGroup.className = "ks-design-group";
  const customHeading = document.createElement("h4");
  customHeading.textContent = "Custom CSS";
  customGroup.appendChild(customHeading);

  const customEntries = Object.entries(node.styles ?? {}).filter(([property, value]) => isCustomStyleProperty(property) && value !== undefined);
  for (const [property, value] of customEntries) {
    renderCustomStyleRow(customGroup, editor, node, property, String(value ?? ""));
  }
  // Always-present blank row so there's a permanent place to add the next property.
  renderCustomStyleRow(customGroup, editor, node, "", "");

  container.appendChild(customGroup);
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
