// Deliberately unconstrained: consumer event map interfaces (e.g. EditorEventMap)
// declare fixed keys without an index signature, which TS does not consider
// assignable to `Record<string, unknown>` even though it's structurally compatible.
export type EugineEventMap = object;

export type Listener<T> = (payload: T) => void;

/**
 * Minimal, dependency-free typed event emitter. Centralizes every structured
 * event Eugine emits (editor.ready, document.change, node.create, ...).
 */
export class EventBus<TEvents extends EugineEventMap> {
  private listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  once<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const listener of Array.from(set)) {
      (listener as Listener<TEvents[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
