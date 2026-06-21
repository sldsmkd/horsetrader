import { test } from "node:test";
import assert from "node:assert/strict";

import { assertPlausiblePlan, load, save } from "./index.ts";
import { CURRENT_VERSION, emptyDocument } from "./document.ts";
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

test("a first-time user loads a clean current-version envelope", () => {
  const result = load(memoryStore());
  assert.equal(result.recovered, false);
  assert.equal(result.envelope.remote.version, CURRENT_VERSION);
  assert.equal(result.envelope.remote.snapshot, undefined);
  assert.deepEqual(result.envelope.local, {});
});

test("inputs incl. the synced trainer name round-trip through save → load", () => {
  const store = memoryStore();
  save(
    {
      local: {},
      remote: {
        version: CURRENT_VERSION,
        config: { identity: { trainerName: "Xelene", oshiId: "1001" } },
        snapshot: { date: "2026-05-28", recordedAt: "2026-05-28T09:15:00.000Z", resources: { free_carats: 1200 } },
        commitments: { "30096": 50 },
        favourites: { "108301": {} },
        rushed: { "banner-30096": "2026-06-08T11:30:00.000Z" },
        notes: { "108301": "save him" },
      },
    },
    store,
  );
  const { envelope, recovered, migrated } = load(store);
  assert.equal(recovered, false);
  assert.equal(migrated, false); // already a current envelope — no upgrade
  assert.deepEqual(envelope.local, {});
  const doc = envelope.remote;
  assert.equal((doc.config?.["identity"] as Record<string, unknown>)?.["trainerName"], "Xelene");
  assert.equal(doc.snapshot?.date, "2026-05-28");
  assert.equal(doc.snapshot?.recordedAt, "2026-05-28T09:15:00.000Z");
  assert.equal(doc.snapshot?.resources.free_carats, 1200);
  assert.equal(doc.commitments?.["30096"], 50);
  assert.deepEqual(doc.favourites?.["108301"], {}); // bare star — note rides its own map now
  assert.equal(doc.notes?.["108301"], "save him");
  assert.equal(doc.rushed?.["banner-30096"], "2026-06-08T11:30:00.000Z");
});

test("v2 → v3 migration: a favourite's note moves into the notes map; the star goes bare", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      local: {},
      remote: {
        version: 2,
        favourites: { "108301": { note: "won't leave the gate" }, "30107": {} },
      },
    }),
  );
  const { envelope, migrated } = quietly(() => load(store));
  assert.equal(migrated, true);
  assert.equal(envelope.remote.version, CURRENT_VERSION);
  assert.equal(envelope.remote.notes?.["108301"], "won't leave the gate");
  assert.deepEqual(envelope.remote.favourites?.["108301"], {}); // star stripped of its note
  assert.deepEqual(envelope.remote.favourites?.["30107"], {});
});

test("the trainer name DOES ride into the synced remote plan", () => {
  const store = memoryStore();
  save({ local: {}, remote: { version: CURRENT_VERSION, config: { identity: { trainerName: "Xelene" } } } }, store);
  // The cloud blob is exactly `remote` — the name travels with it (the sync signal).
  const stored = JSON.parse(store.read(DOCUMENT_KEY) as string);
  assert.equal(stored.remote.config.identity.trainerName, "Xelene");
});

test("a legacy local.username folds into the synced remote plan on load", () => {
  const store = memoryStore();
  // A save from the brief local-only era: name stashed in local, absent from remote.
  store.write(DOCUMENT_KEY, JSON.stringify({ local: { username: "Xelene" }, remote: { version: CURRENT_VERSION } }));
  const { envelope, migrated } = load(store);
  assert.equal(migrated, true); // folding the name back is a durable upgrade
  // It moved INTO the synced plan and OUT of local.
  assert.equal((envelope.remote.config?.["identity"] as Record<string, unknown>)?.["trainerName"], "Xelene");
  assert.equal("username" in envelope.local, false);
});

test("legacy v1 flat doc migrates: trainer name STAYS in the plan, Trainer ID is dropped", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      version: 1,
      config: {
        identity: { trainerName: "Xelene", trainerId: "123456789012", oshiId: "1001" },
        dailyPack: "2026-07-01",
      },
      commitments: { "30096": 50 },
    }),
  );
  const { envelope, recovered, migrated } = quietly(() => load(store));
  assert.equal(recovered, false);
  // A legacy flat doc is an upgrade — flagged so the caller rewrites it durably.
  assert.equal(migrated, true);
  // Nothing lands in local; the name rides in the synced plan now.
  assert.equal("username" in envelope.local, false);
  // The plan migrated to current; the name is kept, only the retired ID is gone.
  assert.equal(envelope.remote.version, CURRENT_VERSION);
  const identity = (envelope.remote.config?.["identity"] ?? {}) as Record<string, unknown>;
  assert.equal(identity["trainerName"], "Xelene");
  assert.equal("trainerId" in identity, false);
  assert.equal(identity["oshiId"], "1001");
  assert.equal(envelope.remote.config?.["dailyPack"], "2026-07-01");
  assert.equal(envelope.remote.commitments?.["30096"], 50);
});

test("legacy v1 identity keeps the trainer name, drops only the retired Trainer ID", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 1, config: { identity: { trainerName: "X", trainerId: "1" } } }));
  const { envelope } = quietly(() => load(store));
  assert.equal("username" in envelope.local, false);
  assert.deepEqual(envelope.remote.config?.["identity"], { trainerName: "X" });
});

test("rushed: non-string timestamps drop; an emptied map normalises to omitted", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({ version: 1, rushed: { good: "2026-06-08T11:30:00.000Z", bad: 0, blank: "" } }),
  );
  const { envelope } = quietly(() => load(store));
  assert.deepEqual(envelope.remote.rushed, { good: "2026-06-08T11:30:00.000Z" });

  // The fully-cleared case app.ts can write (`rushed: {}`) loads back as omitted.
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 1, rushed: {} }));
  assert.equal(load(store).envelope.remote.rushed, undefined);
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
  const { envelope } = quietly(() => load(store));
  assert.deepEqual(envelope.remote.snapshot?.resources, { free_carats: 1200 });
  // A legacy day-only snapshot back-fills `recordedAt` at UTC midnight on load.
  assert.equal(envelope.remote.snapshot?.recordedAt, "2026-05-28T00:00:00.000Z");
  assert.deepEqual(envelope.remote.commitments, { "30096": 50 });
});

test("a commitment loads as a flat integer or a { number, use_paid } entry", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      version: 1,
      commitments: {
        flat: 50, // the common case — bare pity, paid spend off
        paid: { number: 30, use_paid: true }, // the opt-in entry
      },
    }),
  );
  const { envelope } = load(store);
  assert.equal(envelope.remote.commitments?.["flat"], 50);
  assert.deepEqual(envelope.remote.commitments?.["paid"], { number: 30, use_paid: true });
});

test("a commitment entry missing number or use_paid is dropped", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      version: 1,
      commitments: {
        good: { number: 30, use_paid: false },
        noFlag: { number: 30 }, // missing use_paid
        noNumber: { use_paid: true }, // missing number
        badFlag: { number: 30, use_paid: "yes" }, // use_paid not a boolean
      },
    }),
  );
  const { envelope } = quietly(() => load(store));
  assert.deepEqual(envelope.remote.commitments, { good: { number: 30, use_paid: false } });
});

test("a note-less favourite is stored bare ({}), never as an empty note", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({ version: 1, favourites: { "30107": { note: "" }, "108301": {} } }),
  );
  const { envelope } = load(store);
  assert.deepEqual(envelope.remote.favourites?.["30107"], {});
  assert.deepEqual(envelope.remote.favourites?.["108301"], {});
});

test("a corrupt blob fails soft: clean envelope, raw stashed under a backup key", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, "{not json");
  const { envelope, recovered, backupKey } = quietly(() => load(store));
  assert.equal(recovered, true);
  assert.equal(envelope.remote.version, CURRENT_VERSION);
  assert.deepEqual(envelope.local, {});
  assert.ok(backupKey);
  assert.equal(store.read(backupKey), "{not json");
});

test("a document newer than this app understands fails soft rather than misreads", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify({ remote: { version: 999 }, local: {} }));
  const { recovered, backupKey } = quietly(() => load(store));
  assert.equal(recovered, true);
  assert.ok(backupKey);
});

test("the egress shape gate passes a real plan and rejects obvious garbage", () => {
  // A clean document and a fully-populated one both pass.
  assert.doesNotThrow(() => assertPlausiblePlan(emptyDocument()));
  assert.doesNotThrow(() =>
    assertPlausiblePlan({
      version: CURRENT_VERSION,
      snapshot: { date: "2026-06-19", recordedAt: "2026-06-19T00:00:00.000Z", resources: { free_carats: 1 } },
      config: { identity: { trainerName: "X" } },
      commitments: { "30096": 50 },
      favourites: { "108301": {} },
      rushed: { "banner-30096": "2026-06-08T11:30:00.000Z" },
      notes: { "108301": "save him" },
    }),
  );

  // Not our document at all → throws (the load pipeline would never produce these).
  assert.throws(() => assertPlausiblePlan(null));
  assert.throws(() => assertPlausiblePlan("a plan, honest"));
  assert.throws(() => assertPlausiblePlan({ commitments: {} })); // no version
  assert.throws(() => assertPlausiblePlan({ version: CURRENT_VERSION + 1 })); // we never push a future version
  assert.throws(() => assertPlausiblePlan({ version: 0 }));
  // Right top-level key, wrong shape (array / primitive where an object belongs).
  assert.throws(() => assertPlausiblePlan({ version: CURRENT_VERSION, commitments: [] }));
  assert.throws(() => assertPlausiblePlan({ version: CURRENT_VERSION, snapshot: { resources: {} } })); // no date
});
