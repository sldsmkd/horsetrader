export interface Machine<S, E> {
  get(): Readonly<S>;
  send(event: E): void;
  /** Register a listener fired after every `send`; returns an unsubscribe. The
   *  same render-triggering seam as the view/coordinator stores, so the machine
   *  can be the single source of truth for its slice instead of being mirrored
   *  into view-state to provoke a re-render. */
  subscribe(listener: () => void): () => void;
}

export function createMachine<S, E>(reducer: (state: S, event: E) => S, initial: S): Machine<S, E> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    send(event) {
      state = reducer(state, event);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
