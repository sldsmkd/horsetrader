/**
 * The missions income stream: the regular limited-mission campaigns' baked rewards,
 * folded as their *own* stream so the play-style "do you do missions?" toggle can
 * include or exclude them from the projection wholesale.
 *
 * Mechanically this is just the `events` fold restricted to `type: "mission"` events
 * — same folding logic (it delegates to `eventStream` with a predicate), same
 * attribution by event key, same payout on `end`. The split exists purely so the
 * gate can drop the *whole stream* rather than carve a baked reward down: the
 * ground-truth `events` channel folds the complement (non-mission events), this
 * channel folds the mission subset, and the coordinator omits this channel's
 * emissions when `play.missions !== "yes"`. That keeps us on the sanctioned side of
 * [[feedback_no_reshaping_baked_rewards]] — a gating flag toggling a channel on/off
 * (glue.md's bucket 3), not a play-style reshaping a reward value.
 *
 * Scope is **normal** missions only: anniversary missions are their own type
 * (`anniversarymission`) and stay universal — never gated by this toggle. The
 * below-lane card reads this stream's ledger entry by key (belowLane.ts lists
 * `missions` alongside `events`/`sequence`), so a mission card shows its reward when
 * the toggle is on and `{}` when off — the same grammar as a CM at `skip`.
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { CalendarDate } from "../dates.ts";
import type { StreamEmission } from "../ledger.ts";
import { eventStream } from "./events.ts";

/** A regular (non-anniversary) mission campaign — the events this stream owns and
 *  the events the `events` channel must therefore exclude. */
export function isMissionEvent(event: EventsBundle["events"][number]): boolean {
  return event.type === "mission";
}

/** The mission-campaign rewards as a stream. Missions aren't rushable, so `rushed`
 *  is threaded only for signature parity with the `events` fold (no mission key is
 *  ever in it). */
export function missionStream(
  bundle: EventsBundle,
  after: CalendarDate,
  timeZone?: string,
  rushed?: ReadonlySet<string>,
): StreamEmission[] {
  return eventStream(bundle, after, timeZone, rushed, isMissionEvent);
}
