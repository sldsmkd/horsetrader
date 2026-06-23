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

import { CURRENT_VERSION } from "./document.ts";
import type {
  Commitment,
  Commitments,
  Config,
  Favourites,
  LocalState,
  Notes,
  PlanDocument,
  ResourceVector,
  Rushed,
  Snapshot,
} from "./document.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A note is a **cleat** — a short, self-contained line, long enough for a real
 * thought, short enough to never wall a glass card, and a *publishable* unit if
 * Canter ever shares it. `str[140]` — a fully-expressed real planning note (commitment
 * + reasoning + a forward-look) lands ~130, so 140 fits one comfortably while staying
 * scannable in a Desk row. Code points, not UTF-16 units, so an emoji or a CJK character
 * each count once and a cap never splits a surrogate pair.
 */
export const NOTE_MAX_LENGTH = 140;

/** Trainer name — `str[24]`, honouring the limit the player field has always
 *  carried. A handle, not prose: whatever the player wants, within reason. */
export const TRAINER_NAME_MAX = 24;

/** Club name — `str[16]` (the game allows fewer; this is the comfortable ceiling). */
export const CLUB_NAME_MAX = 16;

/** Cap on any single transcribed resource count. Carats are `int[7]` — a balance
 *  tops out at 9,999,999 (a heavy hoarder holds far less; that many paid carats is
 *  half an Aston Martin). The cap stops a typo / fat-finger from storing a nonsense
 *  value that overflows the readout and breaks the projection maths. One home for
 *  the rule (UI spinner + commit clamp + persistence ingress). */
export const MAX_RESOURCE = 9_999_999;

// Disallowed control characters: every C0 control plus DEL, **except** newline
// (a note may be multi-line) — stripped so a save can't carry terminal escapes or
// other invisible junk.
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F]/g;
// Names are a handle: letters, numbers, spaces and emoji only (pictographs + their
// modifiers, regional-indicator flag pairs, ZWJ/variation-selector joiners). Combining
// marks (zalgo), RTL overrides, control chars and punctuation are dropped so a pasted
// name can't smuggle layout-breaking junk.
const NAME_ALLOWED = /[\p{L}\p{N} \p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F]/gu;

// One grapheme segmenter for every length cap — a name's 24/16 and a cleat's 240 are
// all *grapheme* counts, so a ZWJ emoji counts as one and a slice never garbles it
// mid-sequence. Falls back to code points where Intl.Segmenter is unavailable.
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
function graphemes(s: string): string[] {
  return graphemeSegmenter ? [...graphemeSegmenter.segment(s)].map((seg) => seg.segment) : [...s];
}

/**
 * The single note normaliser — the **cleater**, the input contract for the notes
 * layer (Twinkle Monthly · The Interview). Strips control characters (keeping
 * newlines), collapses excess whitespace so a cleat can't be all blank lines
 * (240 newlines pass the grapheme cap but wall the card — a cheap denial of the
 * surface), trims, and caps at `NOTE_MAX_LENGTH`. Whitespace policy: spaces around
 * a newline are dropped, runs of spaces collapse to one, and at most two newlines
 * may sit together (a single blank line for a paragraph break). Returns `""` for a
 * non-string or an empty-after-trim value; the caller treats `""` as "no note"
 * (delete the key, never store empty). Used both at the live write seam (the
 * coordinator) and at the persistence ingress (`validateNotes`), so a typed-in
 * cleat and a hand-edited save get the exact same rules.
 */
export function normaliseNote(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(CONTROL_CHARS_KEEP_NEWLINE, "")
    .replace(/ +/g, " ") // collapse space runs
    .replace(/ *\n */g, "\n") // drop spaces hugging a newline
    .replace(/\n{3,}/g, "\n\n") // at most one blank line between paragraphs
    .trim();
  return graphemes(cleaned).slice(0, NOTE_MAX_LENGTH).join("");
}

/**
 * The single name normaliser — for the trainer name and the club name. A name is a
 * one-line handle: NFC-normalised and reduced to the allow-list (letters, numbers,
 * spaces, emoji), then capped at `max` *graphemes*. It does NOT trim — callers trim
 * at commit, so live keystroke editing can still type an internal/trailing space.
 * Returns `""` for a non-string or empty value. Shared by the coordinator's
 * `setUsername` / `setClub` (each passing its own cap) so both names take one path.
 */
export function normaliseName(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const kept = (raw.normalize("NFC").match(NAME_ALLOWED) ?? []).join("");
  return graphemes(kept).slice(0, max).join("");
}

/**
 * Per-resource caps — the integer width each balance can legitimately reach, so a
 * fat-finger can't store a value the game can't hold:
 *   - carats (free/paid): `int[7]` — 9,999,999 (the `MAX_RESOURCE` default);
 *   - scout tickets: `int[3]` — 999;
 *   - limit-breaker crystals: `int[2]` — 99 (unbuyable, ~3–5 a year);
 *   - their shards: `int[2]` — 99 (20 shards = 1 crystal).
 * Unlisted keys fall back to the carat cap. The one home for the rule, shared by
 * the balance editor (spinner max + commit clamp) and the persistence ingress.
 */
const RESOURCE_CAPS: Record<string, number> = {
  free_carats: MAX_RESOURCE,
  paid_carats: MAX_RESOURCE,
  trainee_tickets: 999,
  support_tickets: 999,
  rainbow_crystal: 99,
  gold_crystal: 99,
  rainbow_crystal_shards: 99,
  gold_crystal_shards: 99,
};

/** The cap for a resource key — its declared width, or the carat default. */
export function resourceCap(key: string): number {
  return RESOURCE_CAPS[key] ?? MAX_RESOURCE;
}

/**
 * The single resource-count normaliser — a transcribed balance is a non-negative
 * integer, capped at the resource's width. Coerces strings, floors fractions,
 * clamps the range, and reads non-finite/garbage as 0. The one home shared by the
 * balance editor (spinner + commit clamp) and the persistence ingress
 * (`numberVector`).
 */
export function normaliseCount(raw: unknown, max: number = MAX_RESOURCE): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

/**
 * Validate the never-synced local state. Tiny by design — `local` holds only the
 * cloud-rev bookkeeping (`sync`); the display name now syncs and lives in `remote`.
 * Anything malformed is simply dropped; a corrupt `local` must never brick the app.
 * (A legacy `local.username` is folded into `remote` by `load`, not read here.)
 */
export function validateLocal(value: unknown): LocalState {
  const local: LocalState = {};
  if (!isObject(value)) return local;
  const sync = value["sync"];
  if (isObject(sync) && (sync["etag"] === null || typeof sync["etag"] === "string")) {
    local.sync = { etag: sync["etag"], dirty: sync["dirty"] === true };
  }
  return local;
}

/**
 * The minimal pre-migration gate: is this even one of our documents? Runs before
 * the migration chain, which may legitimately receive an *older* shape — so this
 * checks only the invariant every version shares: an object with a numeric version.
 */
export function isVersioned(value: unknown): value is { version: number } {
  return isObject(value) && typeof value["version"] === "number" && Number.isFinite(value["version"]);
}

/**
 * Egress shape gate (Unity defence-in-depth — TODO §egress, the client-side twin of the
 * Worker's planned "is this plausibly one of our saves"). A cheap structural assert run on
 * a plan *before* we spend a network push: a bug producing a malformed in-memory document
 * must not ship garbage to the cloud — from where it would sync down and corrupt every
 * other device. Sanity, not full validation: `validateDocument` is the deep per-entry
 * clean at ingress; this only checks the TOP-LEVEL shape we're about to PUT. We push
 * current-versioned data, so an out-of-range version is itself a bug-signal. Throws on
 * anything implausible; `syncNow` turns the throw into an `error` result and sends nothing.
 */
export function assertPlausiblePlan(value: unknown): asserts value is PlanDocument {
  if (!isVersioned(value)) throw new Error("egress: not a plan document (no numeric version)");
  if (!Number.isInteger(value.version) || value.version < 1 || value.version > CURRENT_VERSION) {
    throw new Error(`egress: implausible plan version ${value.version}`);
  }
  const obj = value as Record<string, unknown>;
  for (const key of ["snapshot", "config", "commitments", "favourites", "rushed", "notes"] as const) {
    if (obj[key] !== undefined && !isObject(obj[key])) {
      throw new Error(`egress: plan field "${key}" is not an object`);
    }
  }
  const snapshot = obj["snapshot"];
  if (isObject(snapshot) && typeof snapshot["date"] !== "string") {
    throw new Error("egress: plan snapshot has no string date");
  }
}

function numberVector(value: unknown): ResourceVector {
  const out: ResourceVector = {};
  if (!isObject(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    // Normalise every count to its resource's width (non-negative int, capped) so a
    // stale/tampered snapshot can't carry a negative, a fraction, or an overflow.
    if (typeof v === "number" && Number.isFinite(v)) out[k] = normaliseCount(v, resourceCap(k));
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
  const date = value["date"];
  // `recordedAt` (full UTC instant) is newer than `date`; back-fill legacy
  // day-only readings at UTC midnight so every loaded snapshot carries one.
  const recordedAt = typeof value["recordedAt"] === "string" ? value["recordedAt"] : `${date}T00:00:00.000Z`;
  return { date, recordedAt, resources: numberVector(value["resources"]) };
}

function validateConfig(value: unknown): Config | undefined {
  if (!isObject(value)) return undefined;
  return value;
}

/** A commitment is either a finite pity integer or an object that MUST carry a
 *  finite `number` (the pity) and a boolean `use_paid`. Anything else is dropped. */
function validateCommitment(value: unknown): Commitment | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    isObject(value) &&
    typeof value["number"] === "number" &&
    Number.isFinite(value["number"]) &&
    typeof value["use_paid"] === "boolean"
  ) {
    return { number: value["number"], use_paid: value["use_paid"] };
  }
  return undefined;
}

function validateCommitments(value: unknown): Commitments | undefined {
  if (!isObject(value)) return undefined;
  const out: Commitments = {};
  for (const [bannerId, raw] of Object.entries(value)) {
    const commitment = validateCommitment(raw);
    if (commitment !== undefined) out[bannerId] = commitment;
    else console.warn(`persistence: dropping malformed commitment "${bannerId}"`);
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
    out[entityId] = {}; // bare: the key's presence is the fact (notes are their own layer now)
  }
  return Object.keys(out).length ? out : undefined;
}

/** Validate the notes map: each value normalised (trimmed, capped, control-chars
 *  stripped), entries that normalise to empty dropped. A malformed save can't
 *  carry an oversized or junk-laden note past this gate. */
function validateNotes(value: unknown): Notes | undefined {
  if (!isObject(value)) return undefined;
  const out: Notes = {};
  for (const [subjectId, raw] of Object.entries(value)) {
    const note = normaliseNote(raw);
    if (note) out[subjectId] = note;
    else console.warn(`persistence: dropping empty/malformed note "${subjectId}"`);
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
  const notes = validateNotes(obj["notes"]);
  if (notes) doc.notes = notes;
  return doc;
}
