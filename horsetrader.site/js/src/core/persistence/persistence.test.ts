import { test } from "node:test";
import assert from "node:assert/strict";

import { load, save } from "./index.ts";
import { DOCUMENT_KEY, memoryStore } from "./storage.ts";

/** Silence the intentional warn/error logging the drop/recovery paths emit. */
function quietly<T>(fn: () => T): T {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

test("a first-time user loads a clean current-version document", () => {
  const result = load(memoryStore());
  assert.equal(result.recovered, false);
  assert.equal(result.doc.version, 1);
  assert.equal(result.doc.snapshot, undefined);
});

test("inputs round-trip through save → load", () => {
  const store = memoryStore();
  save(
    {
      version: 1,
      snapshot: { date: "2026-05-28", resources: { free_carats: 1200 } },
      commitments: { "30096": 50 },
      favourites: { "108301": { note: "save him" } },
      rushed: { "banner-30096": "2026-06-08T11:30:00.000Z" },
    },
    store,
  );
  const { doc, recovered } = load(store);
  assert.equal(recovered, false);
  assert.equal(doc.snapshot?.date, "2026-05-28");
  assert.equal(doc.snapshot?.resources.free_carats, 1200);
  assert.equal(doc.commitments?.["30096"], 50);
  assert.equal(doc.favourites?.["108301"]?.note, "save him");
  assert.equal(doc.rushed?.["banner-30096"], "2026-06-08T11:30:00.000Z");
});

test("rushed: non-string timestamps drop; an emptied map normalises to omitted", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({ version: 1, rushed: { good: "2026-06-08T11:30:00.000Z", bad: 0, blank: "" } }),
  );
  const { doc } = quietly(() => load(store));
  assert.deepEqual(doc.rushed, { good: "2026-06-08T11:30:00.000Z" });

  // The fully-cleared case app.ts can write (`rushed: {}`) loads back as omitted.
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 1, rushed: {} }));
  assert.equal(load(store).doc.rushed, undefined);
});

test("non-finite resource and commitment values are dropped, not kept", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      version: 1,
      snapshot: { date: "2026-05-28", resources: { free_carats: 1200, bad: null } },
      commitments: { "30096": 50, broken: "x" },
    }),
  );
  const { doc } = quietly(() => load(store));
  assert.deepEqual(doc.snapshot?.resources, { free_carats: 1200 });
  assert.deepEqual(doc.commitments, { "30096": 50 });
});

test("a note-less favourite is stored bare ({}), never as an empty note", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({ version: 1, favourites: { "30107": { note: "" }, "108301": {} } }),
  );
  const { doc } = load(store);
  assert.deepEqual(doc.favourites?.["30107"], {});
  assert.deepEqual(doc.favourites?.["108301"], {});
});

test("a corrupt blob fails soft: clean doc, raw stashed under a backup key", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, "{not json");
  const { doc, recovered, backupKey } = quietly(() => load(store));
  assert.equal(recovered, true);
  assert.equal(doc.version, 1);
  assert.ok(backupKey);
  assert.equal(store.read(backupKey), "{not json");
});

test("a document newer than this app understands fails soft rather than misreads", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 999 }));
  const { recovered, backupKey } = quietly(() => load(store));
  assert.equal(recovered, true);
  assert.ok(backupKey);
});
