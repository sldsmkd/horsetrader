/**
 * The team-trials channel: the player's recurring weekly Team Trials carats,
 * granted on Monday at server reset and graded by the *transition* into a class
 * that week. Like `routine` it is a **play-style income** channel — it reads a
 * baked reward table (`reward_maps.team-trials`) and the account's `teamTrials`
 * level, and synthesises one weekly emission from the server epoch forward. See
 * docs/frontend/glue.md (engagement levels → recurring income) and
 * docs/frontend/projection.md (graded recurring income).
 *
 * The model (settled with the user, off the in-client Class Rewards table):
 *  - **Cadence is the calendar Monday**, not epoch+7k — the reward lands at the
 *    weekly server reset, the realised moment for the week that just closed.
 *  - **The carats depend on how you entered the class**, not the class alone:
 *    promotion-in / retention / demotion-in each pay differently (only Class 6
 *    actually differs by state; Class ≤5 pays the same in every transition).
 *  - **A "flapping" account is a two-week cadence, not an average.** A mid account
 *    cycles promote-to-6 / demote-to-5: it alternates `6:promotion` (300) and
 *    `5:demotion` (225) every Monday — which the old synthetic `5.5: 262` row had
 *    pre-collapsed to their mean. A stable class is the degenerate length-1 cycle
 *    over its `:retention` row.
 *
 * The client owns only the *cadence* (which Mondays, and the per-Monday state
 * walk); every *value* — each class/transition's carats — comes from the baked
 * config, never a literal here. The flapping phase anchors at the epoch and
 * advances across the snapshot, so it is deterministic and snapshot-independent.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { TeamTrialKey } from "../../playstyle/index.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, addDays } from "../dates.ts";
import { flatPayload } from "./rewardmap.ts";
import { bundleSpan } from "./span.ts";

/** The attribution source for this channel — traceable to the reward-map slug. */
const TEAM_TRIALS_SOURCE = "team-trials";

/** Each play level's weekly cadence: the ordered `reward_maps.team-trials` labels
 *  walked one per Monday, repeating. A stable class collects its `:retention`
 *  every week (length 1); the flapping `rank55` account alternates promotion-into-6
 *  and demotion-into-5 (length 2), starting promoted. Client-owned cadence — the
 *  labels *select* rows, they never carry values. */
const TEAM_TRIALS_CADENCE: Record<TeamTrialKey, string[]> = {
  rank4: ["4:retention"],
  rank5: ["5:retention"],
  rank6: ["6:retention"],
  rank55: ["6:promotion", "5:demotion"],
};

/** The synthesised weekly-income plan: the cadence span and the per-Monday payout
 *  cycle (one `ResourceVector` per Monday, walked in order and repeating). */
export interface TeamTrialsSpec {
  /** Server epoch — the earliest bundle date; the Monday cadence anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** The weekly payout cycle (length 1 = stable class, length 2 = the 5↔6 flap). */
  cycle: ResourceVector[];
}

/** The first Monday on or after `date` (UTC weekday: Sun = 0 … Mon = 1). */
function mondayOnOrAfter(date: CalendarDate): CalendarDate {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  return addDays(date, (8 - weekday) % 7);
}

/**
 * Expand a team-trials spec into one Monday emission per week across
 * `[epoch, horizon]`. The cycle index advances from the epoch's first Monday (so
 * the flapping phase is deterministic and snapshot-independent), but — like the
 * other channels — only Mondays strictly after `after` emit; earlier Mondays are
 * already baked into the snapshot reading, yet still advance the phase.
 */
export function teamTrialsStream(spec: TeamTrialsSpec, after: CalendarDate): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  const { epoch, horizon, cycle } = spec;
  if (cycle.length === 0 || epoch > horizon) return emissions;

  let monday = mondayOnOrAfter(epoch);
  for (let week = 0; monday <= horizon; week++) {
    const deltas = cycle[week % cycle.length];
    if (monday > after) emissions.push({ date: monday, source: TEAM_TRIALS_SOURCE, deltas: { ...deltas } });
    monday = addDays(monday, 7);
  }
  return emissions;
}

/**
 * Build the team-trials spec from the baked config, the bundle's date span, and
 * the play-style team-trials level. Returns `null` when the channel can't run —
 * an unknown play level, a bundle with no events (no epoch/horizon), or the baked
 * map missing a label the selected cadence needs.
 */
export function teamTrialsSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  teamTrials: string,
  timeZone: string = UTC_TIME_ZONE,
): TeamTrialsSpec | null {
  const labels = TEAM_TRIALS_CADENCE[teamTrials as TeamTrialKey];
  if (labels === undefined) return null;

  const tiers = config.reward_maps[TEAM_TRIALS_SOURCE];
  if (tiers === undefined) return null;

  const cycle: ResourceVector[] = [];
  for (const label of labels) {
    const row = tiers[label];
    if (row === undefined) return null; // the cadence names a row the bake doesn't carry
    cycle.push(flatPayload(row));
  }

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, cycle };
}
