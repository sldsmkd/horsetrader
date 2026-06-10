/**
 * The bundle's date span — the earliest start (server epoch) and the latest end
 * (timeline horizon) across every event, bucketed into the projection's calendar
 * timezone. Every synthesised income channel anchors its procedural cadence to
 * this span (routine, team-trials, club-rank, shop-tickets), so the scan lives
 * here once rather than copied per channel. Returns `null` for an empty bundle —
 * a channel with no span can't run.
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, dateStringInTimeZone } from "../dates.ts";

export interface BundleSpan {
  /** Server epoch — the earliest bundle date; procedural cadences anchor here. */
  epoch: CalendarDate;
  /** Last day to generate — the timeline's right edge (the latest bundle date). */
  horizon: CalendarDate;
}

export function bundleSpan(bundle: EventsBundle, timeZone: string = UTC_TIME_ZONE): BundleSpan | null {
  let epoch: CalendarDate | undefined;
  let horizon: CalendarDate | undefined;
  for (const event of bundle.events) {
    const start = dateStringInTimeZone(event.start, timeZone);
    const end = dateStringInTimeZone(event.end, timeZone);
    if (epoch === undefined || start < epoch) epoch = start;
    if (horizon === undefined || end > horizon) horizon = end;
  }
  if (epoch === undefined || horizon === undefined) return null;
  return { epoch, horizon };
}
