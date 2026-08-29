import { getNode, walk, type Editor, type EugineNode } from "eugine";
import { schemaFor } from "./schema.js";
import { DESIGN_FIELDS, DESIGN_GROUPS, isCustomStyleProperty, type DesignFieldDef } from "./styleFields.js";

export function renderLayers(editor: Editor, container: HTMLElement, onSelect: (id: string) => void): void {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "eb-layers";
  const document_ = editor.getDocument();
  const selected = new Set(editor.selection.get());

  walk(document_, (node, depth) => {
    const item = document.createElement("li");
    item.className = "eb-layer-row";
    item.style.paddingLeft = `${depth * 16}px`;
    if (selected.has(node.id)) item.classList.add("eb-layer-selected");

    const label = document.createElement("span");
    label.className = "eb-layer-label";
    label.textContent = node.type;
    label.addEventListener("click", () => onSelect(node.id));
    item.appendChild(label);

    if (node.id !== document_.rootId) {
      const actions = document.createElement("span");
      actions.className = "eb-layer-actions";

      const dup = document.createElement("button");
      dup.textContent = "⧉";
      dup.title = "Duplicate";
      dup.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(editor.duplicate(node.id));
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
  });

  container.appendChild(list);
}

export function renderInspector(editor: Editor, container: HTMLElement): void {
  container.innerHTML = "";
  const selectedId = editor.selection.get()[0];
  if (!selectedId) {
    const empty = document.createElement("p");
    empty.className = "eb-inspector-empty";
    empty.textContent = "Select a component to edit its properties.";
    container.appendChild(empty);
    return;
  }

  const node = getNode(editor.getDocument(), selectedId);
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

  renderDesignSection(editor, node, container);
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

function renderDesignField(container: HTMLElement, editor: Editor, node: EugineNode, field: DesignFieldDef): void {
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

    swatch.addEventListener("input", () => {
      text.value = swatch.value;
      setStyle(editor, node, field.property, swatch.value);
    });
    text.addEventListener("change", () => {
      setStyle(editor, node, field.property, text.value);
      if (/^#[0-9a-f]{6}$/i.test(text.value)) swatch.value = text.value;
    });

    group.append(swatch, text);
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

function renderDesignSection(editor: Editor, node: EugineNode, container: HTMLElement): void {
  renderDesignHeading(container, "Design");

  for (const group of DESIGN_GROUPS) {
    const fields = DESIGN_FIELDS.filter((f) => f.group === group);
    const groupEl = document.createElement("div");
    groupEl.className = "eb-design-group";

    const groupHeading = document.createElement("h4");
    groupHeading.textContent = group;
    groupEl.appendChild(groupHeading);

    for (const field of fields) renderDesignField(groupEl, editor, node, field);
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
