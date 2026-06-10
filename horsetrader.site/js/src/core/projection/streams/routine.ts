/**
 * The routine channel: the player's recurring login income — daily mission carats
 * and the 7-day login-bonus cycle — synthesised from a *play-frequency* gating
 * choice rather than enumerated by the bundle. This is the first **play-style
 * income** channel: it reads the baked reward tables (`reward_structures.dailies`,
 * `reward_structures.weekly-login`) and the account's `weeklyPlay` level, and
 * generates login-day deltas from the server epoch forward. See
 * docs/frontend/glue.md (engagement levels → recurring income) and
 * docs/frontend/projection.md (the procedural-stream decomposition).
 *
 * The model (settled with the user):
 *  - **Login days** are spread evenly across each 7-day block from the epoch —
 *    `daysPerWeek` of every 7 ("prorate the logins over a week"), not front-loaded.
 *  - **Dailies** pay a flat payload on *every* login day (you complete them when
 *    you log in).
 *  - **The login bonus** is the 7-entry cycle, advanced **one step per login** and
 *    resetting every 7 logins — NOT use-or-lose by calendar weekday. Log in 7 times
 *    over 10 days and you collect the whole cycle. So the cycle slot is indexed by
 *    *login count* from the epoch, never by the calendar day; a `null` entry is a
 *    login that simply pays no bonus carat (dailies still land).
 *
 * The client owns only the *cadence* (which days are logins, and the per-login
 * advance); every *value* — the daily payload, the cycle amounts — comes from the
 * baked config, never a literal here. Note `reward_structures.daily-carats` (the
 * paid 30-day carat pack) is deliberately NOT this channel: it is a purchase, not
 * login-gated income.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { WeeklyPlayKey } from "../../playstyle/index.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, addDays, dateStringInTimeZone } from "../dates.ts";

/** Login days per 7-day block for each weekly-play level — the cadence reading of
 *  the gating choice (self-evident from the key; not a game-data value). */
const DAYS_PER_WEEK: Record<WeeklyPlayKey, number> = {
  twoDays: 2,
  fourDays: 4,
  sixDays: 6,
  sevenDays: 7,
};

/** The attribution sources within this channel — traceable to the reward-structure keys. */
const DAILY_SOURCE = "dailies";
const LOGIN_SOURCE = "weekly-login";

/** The synthesised recurring-login plan: the cadence span, the play frequency, and
 *  the two baked payouts (flat daily + per-login-advanced cycle). */
export interface RoutineSpec {
  /** Server epoch — the earliest bundle date; login generation anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** Login days per 7-day block (1..7). */
  daysPerWeek: number;
  /** Flat payout on every login day (the dailies). */
  daily: ResourceVector;
  /** The login-bonus cycle, advanced one step per login (null = no bonus that login). */
  cycle: { resource: string; amounts: (number | null)[] };
}

/** Which offsets in a 7-day block are login days, spread evenly for `daysPerWeek`
 *  logins (`⌊k·7/n⌋` for k in 0..n-1 — strictly increasing and distinct for n ≤ 7,
 *  so logins are smeared across the week rather than clustered at its front). */
function loginOffsets(daysPerWeek: number): number[] {
  const offsets: number[] = [];
  for (let k = 0; k < daysPerWeek; k++) offsets.push(Math.floor((k * 7) / daysPerWeek));
  return offsets;
}

/**
 * Expand a routine spec into login-day emissions across `[epoch, horizon]`. The
 * login *count* advances from the epoch (so the cycle phase at any date is
 * deterministic and snapshot-independent), but — like the other channels — only
 * days strictly after `after` emit; earlier logins are already baked into the
 * snapshot reading, yet they still advance the cycle so the phase stays correct.
 */
export function routineStream(spec: RoutineSpec, after: CalendarDate): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  const { epoch, horizon, daysPerWeek, daily, cycle } = spec;
  if (daysPerWeek <= 0 || cycle.amounts.length === 0 || epoch > horizon) return emissions;

  const offsets = loginOffsets(daysPerWeek);
  let logins = 0;
  for (let block = 0; ; block += 7) {
    let blockExceeded = true;
    for (const offset of offsets) {
      const date = addDays(epoch, block + offset);
      if (date > horizon) break;
      blockExceeded = false;
      const slot = logins % cycle.amounts.length;
      logins++;
      if (date <= after) continue; // already in the snapshot reading; the slot still advanced

      emissions.push({ date, source: DAILY_SOURCE, deltas: { ...daily } });
      const bonus = cycle.amounts[slot];
      if (typeof bonus === "number") emissions.push({ date, source: LOGIN_SOURCE, deltas: { [cycle.resource]: bonus } });
    }
    if (blockExceeded) break; // the whole block fell past the horizon — done
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
 * Build the routine spec from the baked config, the bundle's date span, and the
 * play-style weekly-play level. Returns `null` when the channel can't run — no
 * config, an unknown play level, a bundle with no events (no epoch/horizon), or
 * the baked structures missing their daily payload / login sequence.
 */
export function routineSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  weeklyPlay: string,
  timeZone: string = UTC_TIME_ZONE,
): RoutineSpec | null {
  const daysPerWeek = DAYS_PER_WEEK[weeklyPlay as WeeklyPlayKey];
  if (typeof daysPerWeek !== "number") return null;

  const daily = flatPayload(config.reward_structures["dailies"]);
  if (Object.keys(daily).length === 0) return null;

  const login = config.reward_structures["weekly-login"]?.["sequence"];
  if (typeof login !== "object" || Array.isArray(login)) return null;
  const resource = login["type"];
  const amounts = login["sequence"];
  if (typeof resource !== "string" || !Array.isArray(amounts)) return null;

  let epoch: CalendarDate | undefined;
  let horizon: CalendarDate | undefined;
  for (const event of bundle.events) {
    const start = dateStringInTimeZone(event.start, timeZone);
    const end = dateStringInTimeZone(event.end, timeZone);
    if (epoch === undefined || start < epoch) epoch = start;
    if (horizon === undefined || end > horizon) horizon = end;
  }
  if (epoch === undefined || horizon === undefined) return null;

  return { epoch, horizon, daysPerWeek, daily, cycle: { resource, amounts } };
}
