export interface Machine<S, E> {
  get(): Readonly<S>;
  send(event: E): void;
}

export function createMachine<S, E>(reducer: (state: S, event: E) => S, initial: S): Machine<S, E> {
  let state = initial;
  return {
    get: () => state,
    send(event) {
      state = reducer(state, event);
    },
  };
}
