import { EventBus } from "./events.js";

export interface SelectionEvents {
  select: { ids: string[] };
  deselect: { ids: string[] };
  selectionChange: { ids: string[]; previous: string[] };
}

/**
 * Transient editor state — which nodes are selected. This is intentionally
 * separate from the document model: selection must never be persisted as
 * part of a document (see "Editor State vs Document State" in the PRD).
 */
export class Selection {
  private selected = new Set<string>();
  readonly events = new EventBus<SelectionEvents>();

  get(): string[] {
    return Array.from(this.selected);
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  select(id: string | string[], options: { additive?: boolean } = {}): void {
    const ids = Array.isArray(id) ? id : [id];
    const previous = this.get();
    if (!options.additive) this.selected.clear();
    for (const nodeId of ids) this.selected.add(nodeId);
    this.events.emit("select", { ids });
    this.emitChange(previous);
  }

  deselect(id?: string | string[]): void {
    const previous = this.get();
    if (id === undefined) {
      this.selected.clear();
    } else {
      const ids = Array.isArray(id) ? id : [id];
      for (const nodeId of ids) this.selected.delete(nodeId);
    }
    this.events.emit("deselect", { ids: id === undefined ? previous : Array.isArray(id) ? id : [id] });
    this.emitChange(previous);
  }

  clear(): void {
    this.deselect();
  }

  private emitChange(previous: string[]): void {
    const ids = this.get();
    const changed = ids.length !== previous.length || ids.some((id) => !previous.includes(id));
    if (changed) this.events.emit("selectionChange", { ids, previous });
  }

  onSelectionChange(listener: (payload: SelectionEvents["selectionChange"]) => void): () => void {
    return this.events.on("selectionChange", listener);
  }
}
