import { getNode, walk, type Editor } from "eugine";
import { schemaFor } from "./schema.js";

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

  if (!schema || schema.fields.length === 0) {
    const note = document.createElement("p");
    note.className = "eb-inspector-empty";
    note.textContent = "This component has no editable properties.";
    container.appendChild(note);
    return;
  }

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
}
