import { getNode, walk, type Editor } from "eugine";
import { schemaFor } from "./schema";

export function renderLayers(editor: Editor, container: HTMLElement, onSelect: (id: string, additive: boolean) => void): void {
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

export function renderInspector(editor: Editor, container: HTMLElement): void {
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
    return;
  }

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
