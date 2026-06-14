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
 *    actually differs by state; Classes 2–5 pay the same in every transition).
 *  - **Class 1 is not a steady-state Team Trials class.** The tutorial forces
 *    one competition, promotes the account immediately, and cannot demote back
 *    into Class 1, so the selectable ladder starts at Class 2.
 *  - **A "flapping" account is a two-week cadence, not an average.** A half-rank
 *    cycles promotion into the higher class and demotion into the lower class
 *    every Monday. A stable class is the degenerate length-1 cycle over its
 *    `:retention` row.
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
 *  walked one per Monday, repeating. Stable classes collect `<class>:retention`;
 *  half-ranks alternate promotion into the upper class and demotion into the
 *  lower class, starting promoted. Client-owned cadence — the labels *select*
 *  rows, they never carry values. */
const TEAM_TRIALS_CADENCE: Record<TeamTrialKey, string[]> = {
  rank20: ["2:retention"],
  rank25: ["3:promotion", "2:demotion"],
  rank30: ["3:retention"],
  rank35: ["4:promotion", "3:demotion"],
  rank40: ["4:retention"],
  rank45: ["5:promotion", "4:demotion"],
  rank50: ["5:retention"],
  rank55: ["6:promotion", "5:demotion"],
  rank60: ["6:retention"],
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

function rowForLabel(tiers: ConfigBundle["reward_maps"][string], label: string): ResourceVector | null {
  const row = tiers[label];
  if (row !== undefined) return flatPayload(row);
  if (label === "1:retention") return {};

  // Classes 2–5 pay the same amount for promotion/retention/demotion in the
  // observed reward table. If a transition row is omitted, fall back to the
  // destination class's retention row.
  const match = /^([2-5]):(?:promotion|demotion)$/.exec(label);
  if (!match) return null;

  const retention = tiers[`${match[1]}:retention`];
  return retention === undefined ? null : flatPayload(retention);
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
    const row = rowForLabel(tiers, label);
    if (row === null) return null; // the cadence names a row the bake doesn't carry
    cycle.push(row);
  }

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, cycle };
}
