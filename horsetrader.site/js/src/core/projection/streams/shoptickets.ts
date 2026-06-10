/**
 * The shop-tickets channel: the scout tickets a player buys from the shop each
 * month, credited on the 1st when the stores refresh. A play-style income channel
 * like routine/team-trials, but its number is **pure engagement** — how many of the
 * (up to 7) of each scout-ticket type the player bothers to buy. There is no baked
 * rate to scale: the bracket count *is* the ticket count, exactly as routine's
 * `DAYS_PER_WEEK` maps an engagement level straight to a number (docs/frontend/
 * glue.md — a gating choice, not a game-data literal). Each bracket buys the same
 * count of *both* scout-ticket types (`trainee_tickets` + `support_tickets`).
 *
 * Cadence is the shared `monthlyStream` (1st of each month, like club-rank). The
 * `none` bracket pays nothing (the empty payload short-circuits to no emissions).
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ShopTicketKey } from "../../playstyle/index.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE } from "../dates.ts";
import { monthlyStream } from "./monthly.ts";
import { bundleSpan } from "./span.ts";

/** The attribution source for this channel. */
const SHOP_TICKETS_SOURCE = "shop-tickets";

/** Scout tickets of *each* type bought per month at each engagement level — the
 *  bracket-to-count map (an engagement choice, like routine's `DAYS_PER_WEEK`, not
 *  a baked rate). `none` = "didn't know the shop sold them"; `rainbow` = the whale
 *  ceiling (every cleat plus friend points). */
const SHOP_TICKETS_PER_MONTH: Record<ShopTicketKey, number> = {
  none: 0,
  cleats: 4,
  friendPoints: 6,
  rainbow: 7,
};

/** The synthesised monthly-income plan: the cadence span and the flat per-month payout. */
export interface ShopTicketsSpec {
  /** Server epoch — the earliest bundle date; the monthly cadence anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** The flat monthly payout (`{trainee_tickets, support_tickets}`), or `{}` for `none`. */
  monthly: ResourceVector;
}

/** Expand a shop-tickets spec into one emission per month-start across the span. */
export function shopTicketsStream(spec: ShopTicketsSpec, after: CalendarDate): StreamEmission[] {
  if (Object.keys(spec.monthly).length === 0) return []; // the `none` bracket
  return monthlyStream(spec.epoch, spec.horizon, after, SHOP_TICKETS_SOURCE, spec.monthly);
}

/**
 * Build the shop-tickets spec from the bundle's date span and the play-style
 * shop-tickets level. Needs no config — the payload is the engagement bracket
 * itself. Returns `null` when it can't run: an unknown level, or a bundle with no
 * events (no span).
 */
export function shopTicketsSpecFromBundle(
  bundle: EventsBundle,
  shopTickets: string,
  timeZone: string = UTC_TIME_ZONE,
): ShopTicketsSpec | null {
  const count = SHOP_TICKETS_PER_MONTH[shopTickets as ShopTicketKey];
  if (count === undefined) return null;

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  const monthly: ResourceVector = count > 0 ? { trainee_tickets: count, support_tickets: count } : {};
  return { epoch: span.epoch, horizon: span.horizon, monthly };
}
