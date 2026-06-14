export interface Machine<S, E> {
  get(): Readonly<S>;
  /** Reduce `event` into state. `silent` updates state without firing listeners
   *  — for changes whose UI is updated in place (no full re-render needed), but
   *  which must still persist for the next real render to read. */
  send(event: E, opts?: { silent?: boolean }): void;
  /** Register a listener fired after every non-silent `send`; returns an
   *  unsubscribe. The same render-triggering seam as the view/coordinator
   *  stores, so the machine can be the single source of truth for its slice
   *  instead of being mirrored into view-state to provoke a re-render. */
  subscribe(listener: () => void): () => void;
}

export function createMachine<S, E>(reducer: (state: S, event: E) => S, initial: S): Machine<S, E> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    send(event, opts) {
      state = reducer(state, event);
      if (opts?.silent) return;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
