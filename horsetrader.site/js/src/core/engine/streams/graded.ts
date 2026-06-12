/**
 * The three GradedStamp claimers — each owns a baked type whose cards must stay
 * on the lane regardless of play, so each is always-enabled and grades the FACE
 * (eclipse/4.REGISTRY.md: enabled is presence, not pricing). The labels here
 * *select* baked rows; every carat/ticket figure comes from the config bundle,
 * never a literal (docs/frontend/conventions.md).
 */

import type { ChampionsMeetingKey, StoryEventKey } from "../../playstyle/index.ts";
import { flatPayload } from "../../projection/streams/rewardmap.ts";
import { gradedStamp } from "../rules/gradedstamp.ts";

/** Map each play-style CM level to the `reward_maps.champions-meeting` label it
 *  claims — the best finish that level expects. `skip` stamps nothing (the CM
 *  renders unpriced). A frontend interpretation of the slider; the table carries
 *  more granularity (Open League, the spare 2nd-place rows) than the levels expose. */
const CHAMPIONS_MEETING_LABELS: Record<ChampionsMeetingKey, string | null> = {
  skip: null,
  groupBContender: "Group B 3rd",
  groupBWinner: "Group B 1st",
  groupARunnerUp: "Second",
  groupAChampion: "Champion",
};

/** `play.champions-meeting` — CM records carry no baked reward (rank-dependent,
 *  issue #19); the row reconstitutes the player's expected finish onto the face. */
export const playChampionsMeeting = gradedStamp({
  id: "play.champions-meeting",
  claims: ["cm"],
  row(ctx) {
    const label = CHAMPIONS_MEETING_LABELS[ctx.play.championsMeeting as ChampionsMeetingKey];
    if (!label) return null; // `skip` or an unknown level — nothing to stamp
    const row = ctx.config.reward_maps["champions-meeting"]?.[label];
    return row ? flatPayload(row) : null; // the bake doesn't carry the selected rank
  },
});

/** Each play-style `storyEvents` archetype → the reward-map tier label it selects.
 *  The map carries only the four engagement tiers, so the two "achievement"
 *  archetypes both fold onto `dedicated` (the 600k→ceiling stretch is featureless
 *  grind — the ETL collapses them to one row). */
const STORY_TIER: Record<StoryEventKey, string> = {
  story: "sweetie",
  welfare: "casual",
  major: "focused",
  achievement: "dedicated",
  earlyAchievement: "dedicated",
};

/** `play.story` — stories carry no rewards of their own; the row is the curated
 *  era ladder (`reward_maps["story-<era>"]`) at the player's tier. A story with
 *  no era (the proto era) or an era/tier the bake doesn't carry stamps nothing. */
export const playStory = gradedStamp({
  id: "play.story",
  claims: ["story"],
  row(ctx, event) {
    if (!("era" in event) || !event.era) return null; // proto era — not modelled, pays nothing
    const row = ctx.config.reward_maps[`story-${event.era}`]?.[STORY_TIER[ctx.play.storyEvents]];
    return row ? flatPayload(row) : null;
  },
});

/** `subscription.training-pass` — the binary-graded stamp: every Training Pass
 *  event's baked face IS the free track (universal); owning the premium track
 *  stamps the one `reward_maps["training-pass"]["premium"]` row on top. The
 *  subscription is the row lever, never the gate — the events render regardless. */
export const subscriptionTrainingPass = gradedStamp({
  id: "subscription.training-pass",
  claims: ["trainingpass"],
  row(ctx) {
    if (!ctx.trainingPass) return null; // free track only — the baked face stands
    const row = ctx.config.reward_maps["training-pass"]?.["premium"];
    return row ? flatPayload(row) : null;
  },
});
