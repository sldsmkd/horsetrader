/**
 * The daily-pack channel ("dolphin mode"): the recurring income of the **Daily
 * Carat Pack** subscription, modelled — at the user's request — as an always-on
 * subscription rather than a tracked one-off purchase. While subscribed the pack
 * pays two streams, both straight off the baked `reward_structures.daily-carats`:
 *   - **50 free carats every day** (the structure's `generator.free_carats`),
 *     dropped in the mailbox. The bake carries it as a 30-day generator, but since
 *     we assume the player re-buys each cycle the drip is continuous across the
 *     whole span, not gated to a single window.
 *   - **500 paid carats at each purchase** (the structure's `paid_carats`) — once
 *     per billing cycle, on the cycle boundary. The cycle length is the generator's
 *     `repeat` (30 days), so a purchase lands exactly as the prior pack lapses.
 *
 * The player enters one thing: the **validity date** from the game's own UI (the
 * "additional purchase available from …" date — a cycle boundary). From it we phase
 * the cycle and backfill boundaries across the whole span, so the paid payouts land
 * on the right days going forward. Like every income channel, only payouts strictly
 * after the snapshot (`after`) emit — earlier ones are baked into the reading.
 *
 * The client owns only the *cadence* (daily drip + the cycle phase); every *value*
 * comes from the baked config, never a literal here (the standing rule, see
 * routine.ts — which documents `daily-carats` as deliberately *its* non-concern,
 * a purchase rather than login-gated income).
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { Config } from "../../persistence/document.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, addDays, cal, daysBetween } from "../dates.ts";
import { bundleSpan } from "./span.ts";

/** The attribution source for this channel; also its baked `reward_structures` key. */
const DAILY_PACK_SOURCE = "daily-carats";

/** The synthesised subscription plan: the cadence span, a cycle boundary to phase
 *  from, and the two baked payouts (daily free drip + per-cycle paid grant). */
export interface DailyPackSpec {
  /** Server epoch — the earliest bundle date; the daily drip starts no earlier. */
  epoch: CalendarDate;
  /** Last day to generate — the timeline's right edge. */
  horizon: CalendarDate;
  /** A purchase boundary (the validity date); the cycle is phased off it. */
  anchor: CalendarDate;
  /** Free carats mailed each day while subscribed (`generator.free_carats`). */
  dailyFree: number;
  /** Paid carats granted at each purchase (`paid_carats`). */
  cyclePaid: number;
  /** The billing cycle / validity window in days (`generator.repeat`). */
  cycleDays: number;
}

/**
 * Read the subscription's validity date out of `config.dailyPack`. A non-empty
 * `YYYY-MM-DD` string *is* the subscription (its presence enables the channel); a
 * missing or malformed value means not subscribed (`null`) — the signal the channel
 * reads to pay nothing. The single source of that precedence, mirroring `resolveClub`.
 */
export function resolveDailyPack(config: Config | undefined): CalendarDate | null {
  const raw = config?.["dailyPack"];
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return cal(raw.trim());
  } catch {
    return null; // not a bare calendar date — treat as unset
  }
}

/**
 * Expand a subscription spec into its two emission streams: a daily free-carat drop
 * across the whole span, and a paid-carat payout on every cycle boundary phased off
 * `anchor`. Both are filtered to days strictly after `after`.
 */
export function dailyPackStream(spec: DailyPackSpec, after: CalendarDate): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  if (spec.cycleDays <= 0 || spec.epoch > spec.horizon) return emissions;

  // Daily free carats — start at the later of the epoch and the day after the
  // snapshot, so the whole pre-snapshot history isn't generated just to be filtered.
  const firstDay = spec.epoch > after ? spec.epoch : addDays(after, 1);
  for (let day = firstDay; day <= spec.horizon; day = addDays(day, 1)) {
    emissions.push({ date: day, source: DAILY_PACK_SOURCE, deltas: { free_carats: spec.dailyFree } });
  }

  // Paid carats on each cycle boundary. The boundaries are `anchor + k·cycleDays`;
  // find the first one at or after the epoch, then step forward to the horizon.
  const phase = ((daysBetween(spec.anchor, spec.epoch) % spec.cycleDays) + spec.cycleDays) % spec.cycleDays;
  const firstBoundary = addDays(spec.epoch, (spec.cycleDays - phase) % spec.cycleDays);
  for (let boundary = firstBoundary; boundary <= spec.horizon; boundary = addDays(boundary, spec.cycleDays)) {
    if (boundary > after) emissions.push({ date: boundary, source: DAILY_PACK_SOURCE, deltas: { paid_carats: spec.cyclePaid } });
  }

  return emissions;
}

/**
 * Build the daily-pack spec from the baked config, the bundle's date span, and the
 * resolved validity date. Returns `null` when it can't run: not subscribed (`anchor`
 * null), a bundle with no events (no span), or the baked `daily-carats` structure
 * missing its paid grant / daily generator.
 */
export function dailyPackSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  anchor: CalendarDate | null,
  timeZone: string = UTC_TIME_ZONE,
): DailyPackSpec | null {
  if (anchor === null) return null;

  const struct = config.reward_structures["daily-carats"];
  if (!struct) return null;
  const cyclePaid = struct["paid_carats"];
  const generator = struct["generator"];
  if (typeof cyclePaid !== "number" || typeof generator !== "object" || Array.isArray(generator)) return null;
  const dailyFree = generator["free_carats"];
  const cycleDays = generator["repeat"];
  if (typeof dailyFree !== "number" || typeof cycleDays !== "number") return null;

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, anchor, dailyFree, cyclePaid, cycleDays };
}
