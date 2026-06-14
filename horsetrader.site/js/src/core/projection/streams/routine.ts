/**
 * The routine primitives: two independent recurring play channels.
 *
 * `play.dailies` pays the baked daily-mission payload every day when enabled.
 * `play.weekly-login` walks the baked 7-login reward cycle one slot per day when
 * enabled. Both are deliberately on/off assumptions: we no longer model partial
 * weekly cadence from the playstyle preset.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, addDays } from "../dates.ts";
import { bundleSpan } from "./span.ts";

/** The attribution sources within this channel — traceable to the reward-structure keys. */
const DAILY_SOURCE = "dailies";
const LOGIN_SOURCE = "weekly-login";

export interface DailiesSpec {
  /** Server epoch — the earliest bundle date; login generation anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** Flat payout on every enabled daily. */
  daily: ResourceVector;
}

export interface WeeklyLoginSpec {
  /** Server epoch — the earliest bundle date; the daily cycle anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** The login-bonus cycle, advanced one step per enabled day (null = no bonus that day). */
  cycle: { resource: string; amounts: (number | null)[] };
}

/** Expand daily missions into one emission per day across `[epoch, horizon]`. */
export function dailiesStream(spec: DailiesSpec, after: CalendarDate): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  const { epoch, horizon, daily } = spec;
  if (Object.keys(daily).length === 0 || epoch > horizon) return emissions;
  for (let date = epoch; date <= horizon; date = addDays(date, 1)) {
    if (date > after) emissions.push({ date, source: DAILY_SOURCE, deltas: { ...daily } });
  }
  return emissions;
}

/**
 * Expand weekly-login rewards into paying cycle slots across `[epoch, horizon]`.
 * The cycle advances daily from the epoch so phase is deterministic and
 * snapshot-independent; null slots simply emit nothing.
 */
export function weeklyLoginStream(spec: WeeklyLoginSpec, after: CalendarDate): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  const { epoch, horizon, cycle } = spec;
  if (cycle.amounts.length === 0 || epoch > horizon) return emissions;

  let slot = 0;
  for (let date = epoch; date <= horizon; date = addDays(date, 1)) {
    const bonus = cycle.amounts[slot % cycle.amounts.length];
    slot++;
    if (date <= after) continue;
    if (typeof bonus === "number") emissions.push({ date, source: LOGIN_SOURCE, deltas: { [cycle.resource]: bonus } });
  }
  return emissions;
}

/** Pull the numeric payload off a flat reward-structure entry (`{free_carats: 75}`). */
function flatPayload(entry: ConfigBundle["reward_structures"][string] | undefined): ResourceVector {
  const payload: ResourceVector = {};
  if (!entry) return payload;
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === "number") payload[key] = value;
  }
  return payload;
}

/**
 * Build the dailies spec from the baked config and bundle span. Returns `null`
 * when the channel can't run — a bundle with no events or missing daily payload.
 */
export function dailiesSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  timeZone: string = UTC_TIME_ZONE,
): DailiesSpec | null {
  const daily = flatPayload(config.reward_structures["dailies"]);
  if (Object.keys(daily).length === 0) return null;

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, daily };
}

/** Build the weekly-login spec from the baked config and bundle span. */
export function weeklyLoginSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  timeZone: string = UTC_TIME_ZONE,
): WeeklyLoginSpec | null {
  const login = config.reward_structures["weekly-login"]?.["sequence"];
  if (typeof login !== "object" || Array.isArray(login)) return null;
  const resource = login["type"];
  const amounts = login["sequence"];
  if (typeof resource !== "string" || !Array.isArray(amounts)) return null;

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, cycle: { resource, amounts } };
}
