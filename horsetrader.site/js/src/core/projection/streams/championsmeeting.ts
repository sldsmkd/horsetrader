/**
 * Champions Meeting rewards: not a channel, an **event enrichment**. CM events
 * (`type: "cm"`) are real cards on the timeline, but the bake stamps no rewards on
 * them — PvP payouts depend on the rank the player reaches (issue #19), which is a
 * play-style choice, not bundle data. This module reconstitutes that reward: given
 * the baked `reward_maps.champions-meeting` table and the account's
 * `championsMeeting` level, it stamps the rank's payout onto every CM record.
 *
 * Why an enrichment and not an income channel (unlike `team-trials`/`routine`): a
 * CM *is an event*. Stamping its reward lets the existing `events` channel fold it
 * — attributed to the CM's own key, paid on its `end` (the last day) for free — and
 * lets the below-lane card render the reward icon, since the card reads its reward
 * from the `events`-stream ledger entry keyed by the event key. A parallel channel
 * on its own source would fold the carats but never show on the card. The bundle is
 * reshaped before the fold, the same grammar as `rushed` reshaping event timing —
 * the ground-truth `events` channel stays config/play-agnostic. See
 * docs/frontend/glue.md.
 *
 * The level→label map is a **frontend interpretation** (the slider exposes fewer
 * outcomes — skip / Group B contender·winner / Group A runner-up·champion — than the
 * table enumerates; Open League + the spare 2nd-place rows go unused). `skip`
 * resolves to no reward, so the bundle passes through untouched. These labels
 * *select* rows; every carat/ticket figure comes from the baked config.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ChampionsMeetingKey } from "../../playstyle/index.ts";
import type { ResourceVector } from "../ledger.ts";

/** The reward-map slug carrying the CM rank rows. */
const CHAMPIONS_MEETING_SOURCE = "champions-meeting";

/** Map each play-style CM level to the `reward_maps.champions-meeting` label it
 *  claims — the best finish that level expects. `skip` earns no reward (null). A
 *  frontend interpretation of the slider; the table carries more granularity
 *  (Open League, the spare 2nd-place rows) than the levels expose. */
const CHAMPIONS_MEETING_LABELS: Record<ChampionsMeetingKey, string | null> = {
  skip: null,
  groupBContender: "Group B 3rd",
  groupBWinner: "Group B 1st",
  groupARunnerUp: "Second",
  groupAChampion: "Champion",
};

/** Pull the numeric payload off a baked reward-map row (drops non-numeric fields). */
function flatPayload(row: ConfigBundle["reward_maps"][string][string]): ResourceVector {
  const payload: ResourceVector = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "number") payload[key] = value;
  }
  return payload;
}

/**
 * The reward a CM pays at the player's chosen rank, or `null` when there is none to
 * stamp — the `skip` level, an unknown level, or the baked map missing the selected
 * label. Pure lookup off the config; the cadence (which CMs, on what day) is the
 * events channel's job once the reward lands on the record.
 */
export function championsMeetingReward(config: ConfigBundle, championsMeeting: string): ResourceVector | null {
  const label = CHAMPIONS_MEETING_LABELS[championsMeeting as ChampionsMeetingKey];
  if (!label) return null; // `skip` or an unknown level — nothing to stamp
  const row = config.reward_maps[CHAMPIONS_MEETING_SOURCE]?.[label];
  return row ? flatPayload(row) : null; // the bake doesn't carry the selected rank
}

/**
 * Return the bundle with the rank's CM reward stamped onto every `type:"cm"` record
 * — inserting the rank payload and replacing on key conflict (`...ev.rewards,
 * ...reward`), so a CM keeps any baked reward it already carried plus the rank's.
 * The bundle passes through unchanged when there is no reward to stamp (`skip`,
 * unknown level, missing row). Non-mutating: new records, never the baked ones.
 */
export function applyChampionsMeetingRewards(
  bundle: EventsBundle,
  config: ConfigBundle,
  championsMeeting: string,
): EventsBundle {
  const reward = championsMeetingReward(config, championsMeeting);
  if (!reward) return bundle;
  return {
    events: bundle.events.map((ev) =>
      ev.type === "cm" ? { ...ev, rewards: { ...ev.rewards, ...reward } } : ev,
    ),
  };
}
