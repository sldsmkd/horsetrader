/**
 * Validation at the user-input ingress. This is the untrusted boundary (a
 * corrupt or stale localStorage blob, a previous app version), but it is a
 * single-user, local-only planner: validation means malformed input can't brick
 * the user's own save or break the app — not threat defence. Validate shape and
 * type, degrade gracefully, don't gold-plate (see docs/frontend/trust-and-failure.md).
 *
 * Per-item soft tier: a malformed sub-entry is dropped with a `console.warn`, not
 * a thrown error. We throw only when the blob isn't recognisably our document at
 * all — the load pipeline turns that throw into fail-soft recovery.
 */

import type {
  Commitments,
  Config,
  Favourites,
  FavouriteEntry,
  PlanDocument,
  ResourceVector,
  Rushed,
  Snapshot,
} from "./document.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The minimal pre-migration gate: is this even one of our documents? Runs before
 * the migration chain, which may legitimately receive an *older* shape — so this
 * checks only the invariant every version shares: an object with a numeric version.
 */
export function isVersioned(value: unknown): value is { version: number } {
  return isObject(value) && typeof value["version"] === "number" && Number.isFinite(value["version"]);
}

function numberVector(value: unknown): ResourceVector {
  const out: ResourceVector = {};
  if (!isObject(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else console.warn(`persistence: dropping non-numeric resource "${k}"`);
  }
  return out;
}

function validateSnapshot(value: unknown): Snapshot | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value["date"] !== "string") {
    console.warn("persistence: dropping snapshot with no date");
    return undefined;
  }
  return { date: value["date"], resources: numberVector(value["resources"]) };
}

function validateConfig(value: unknown): Config | undefined {
  if (!isObject(value)) return undefined;
  return value;
}

function validateCommitments(value: unknown): Commitments | undefined {
  if (!isObject(value)) return undefined;
  const out: Commitments = {};
  for (const [bannerId, amount] of Object.entries(value)) {
    if (typeof amount === "number" && Number.isFinite(amount)) out[bannerId] = amount;
    else console.warn(`persistence: dropping non-numeric commitment "${bannerId}"`);
  }
  return Object.keys(out).length ? out : undefined;
}

function validateFavourites(value: unknown): Favourites | undefined {
  if (!isObject(value)) return undefined;
  const out: Favourites = {};
  for (const [entityId, entry] of Object.entries(value)) {
    if (!isObject(entry)) {
      console.warn(`persistence: dropping malformed favourite "${entityId}"`);
      continue;
    }
    const favourite: FavouriteEntry = {};
    if (typeof entry["note"] === "string" && entry["note"] !== "") favourite.note = entry["note"];
    out[entityId] = favourite;
  }
  return Object.keys(out).length ? out : undefined;
}

function validateRushed(value: unknown): Rushed | undefined {
  if (!isObject(value)) return undefined;
  const out: Rushed = {};
  for (const [eventId, instant] of Object.entries(value)) {
    if (typeof instant === "string" && instant !== "") out[eventId] = instant;
    else console.warn(`persistence: dropping malformed rushed entry "${eventId}"`);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Validate the post-migration blob into a current `PlanDocument`, dropping bad
 * sub-entries. Throws only if the blob isn't recognisably our document — the
 * caller turns that into fail-soft recovery.
 */
export function validateDocument(value: unknown): PlanDocument {
  if (!isVersioned(value)) throw new Error("not a recognisable plan document");
  const obj = value as Record<string, unknown>;

  const doc: PlanDocument = { version: obj["version"] as number };
  const snapshot = validateSnapshot(obj["snapshot"]);
  if (snapshot) doc.snapshot = snapshot;
  const config = validateConfig(obj["config"]);
  if (config) doc.config = config;
  const commitments = validateCommitments(obj["commitments"]);
  if (commitments) doc.commitments = commitments;
  const favourites = validateFavourites(obj["favourites"]);
  if (favourites) doc.favourites = favourites;
  const rushed = validateRushed(obj["rushed"]);
  if (rushed) doc.rushed = rushed;
  return doc;
}
