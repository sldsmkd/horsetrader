/**
 * Optional event flags — the bundle's tri-state booleans (`true` / `false` /
 * absent). Each flag is **presence-encoded with a per-flag absence default**
 * (docs/contract.md, "Optional flags"): `visible` defaults *true* (opt-out),
 * `rushable` defaults *false* (opt-in) — they invert each other. Read every flag
 * through its named reader here so a default lives in exactly **one** place and
 * never scatters as `!== false` / `=== true` checks across call sites.
 *
 * The generated bundle type doesn't carry every flag yet (the ETL ships them as
 * mixins over time, and absence is a valid state regardless), so reads go through
 * a structural view — the single spot the forthcoming-field cast lives, to be
 * dropped once `gen:types` picks each field up.
 */

import type { EventsBundle } from "./events.gen.ts";

type EventRecord = EventsBundle["events"][number];

/** The optional flags an event may carry — a structural view over the record. */
interface EventFlags {
  visible?: boolean;
  rushable?: boolean;
}

/** Collapse a tri-state flag (`true` / `false` / absent) onto its default. */
function flag(value: boolean | undefined, fallback: boolean): boolean {
  return value ?? fallback;
}

/** Shown unless explicitly hidden — opt-out, default true (contract). */
export const isVisible = (ev: EventRecord): boolean => flag((ev as EventFlags).visible, true);

/** Rushable only when explicitly marked — opt-in, default false (contract). */
export const isRushable = (ev: EventRecord): boolean => flag((ev as EventFlags).rushable, false);
