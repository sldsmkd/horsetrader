import { test } from "node:test";
import assert from "node:assert/strict";

import { createViewStore } from "./viewState.ts";

test("starts idle; set merges a patch and exposes it", () => {
  const store = createViewStore();
  assert.deepEqual(store.get(), { overlay: null, selection: null, search: "" });
  store.set({ overlay: "resources" });
  assert.deepEqual(store.get(), { overlay: "resources", selection: null, search: "" });
});

test("subscribe fires on set; unsubscribe stops delivery", () => {
  const store = createViewStore();
  let n = 0;
  const off = store.subscribe(() => n++);
  store.set({ search: "fuji" });
  assert.equal(n, 1);
  store.set({ search: "fuji oguri" });
  assert.equal(n, 2);
  off();
  store.set({ search: "" });
  assert.equal(n, 2);
});

test("a bare get does not notify — the read path never broadcasts", () => {
  const store = createViewStore();
  let n = 0;
  store.subscribe(() => n++);
  store.get();
  store.get();
  assert.equal(n, 0);
});
