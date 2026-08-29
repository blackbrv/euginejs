// Deliberately unconstrained: consumer event map interfaces (e.g. EditorEventMap)
// declare fixed keys without an index signature, which TS does not consider
// assignable to `Record<string, unknown>` even though it's structurally compatible.
export type EugineEventMap = object;

export type Listener<T> = (payload: T) => void;

/** Called when a listener throws. See EventBusOptions.onListenerError. */
export type ListenerErrorHandler = (error: unknown, event: string) => void;

export interface EventBusOptions {
  /**
   * Invoked for each listener that throws during emit(). If omitted, the error
   * is rethrown from a microtask so it still reaches window.onerror /
   * uncaughtException instead of vanishing — a listener that throws must never
   * be silently swallowed, but it must also never take the emit loop with it.
   */
  onListenerError?: ListenerErrorHandler;
}

/**
 * Minimal, dependency-free typed event emitter. Centralizes every structured
 * event Eugine emits (editor.ready, document.change, node.create, ...).
 *
 * Listeners are isolated: one throwing listener does not stop the ones
 * registered after it. Without that, a single bad subscriber — a collaboration
 * handler hitting a dropped socket, say — would abort the emit loop and stop
 * the renderer from ever hearing about the change, leaving the user editing a
 * canvas that no longer reflects the document.
 */
export class EventBus<TEvents extends EugineEventMap> {
  private listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();
  private readonly onListenerError: ListenerErrorHandler;

  constructor(options: EventBusOptions = {}) {
    this.onListenerError =
      options.onListenerError ??
      ((error) => {
        queueMicrotask(() => {
          throw error;
        });
      });
  }

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
      try {
        (listener as Listener<TEvents[K]>)(payload);
      } catch (error) {
        this.onListenerError(error, String(event));
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
