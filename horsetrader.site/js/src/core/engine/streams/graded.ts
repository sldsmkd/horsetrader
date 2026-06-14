/**
 * The three GradedStamp claimers — each owns a baked type whose cards must stay
 * on the lane regardless of play, so each is always-enabled and grades the FACE
 * (eclipse/4.REGISTRY.md: enabled is presence, not pricing). The labels here
 * *select* baked rows; every carat/ticket figure comes from the config bundle,
 * never a literal (docs/frontend/conventions.md).
 */

import type { ChampionsMeetingKey, LeagueOfHeroesKey, MastersKey } from "../../playstyle/index.ts";
import type { ResourceVector } from "../../projection/ledger.ts";
import { flatPayload } from "../../projection/streams/rewardmap.ts";
import { gradedStamp } from "../rules/gradedstamp.ts";

const LEAGUE_OF_HEROES_LABELS: Record<LeagueOfHeroesKey, string | null> = {
  off: null,
  silver4: "Silver 4",
  gold1: "Gold 1",
  gold2: "Gold 2",
  gold3: "Gold 3",
  gold4: "Gold 4",
  platinum1: "Platinum 1",
  platinum2: "Platinum 2",
  platinum3: "Platinum 3",
  platinum4: "Platinum 4",
};

function addPayloads(...payloads: readonly (ResourceVector | null)[]): ResourceVector | null {
  const out: ResourceVector = {};
  for (const payload of payloads) {
    if (!payload) continue;
    for (const [key, value] of Object.entries(payload)) out[key] = (out[key] ?? 0) + value;
  }
  return Object.keys(out).length ? out : null;
}

/** Map each play-style CM level to the `reward_maps.champions-meeting` label it
 *  claims — the best finish that level expects. `off` stamps nothing (the CM
 *  renders unpriced). A frontend interpretation of the slider; the table carries
 *  more granularity (Open League, the spare 2nd-place rows) than the levels expose. */
const CHAMPIONS_MEETING_LABELS: Record<ChampionsMeetingKey, string | null> = {
  off: null,
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
    if (!label) return null; // `off` or an unknown level — nothing to stamp
    const row = ctx.config.reward_maps["champions-meeting"]?.[label];
    return row ? flatPayload(row) : null; // the bake doesn't carry the selected rank
  },
});

/** `play.story` — stories carry no rewards of their own; the row is the curated
 *  era ladder (`reward_maps["story-<era>"]`), keyed by preset-agnostic commitment
 *  tiers. The play-style `storyEvents` selector IS the tier key: `tier0` is
 *  no-participation (stamp nothing — don't paint a +0 face), `tier1`…`tier4` are
 *  the Pt-commitment rungs. A story with no era (the proto era) or an era the
 *  bake doesn't carry stamps nothing. */
export const playStory = gradedStamp({
  id: "play.story",
  claims: ["story"],
  row(ctx, event) {
    if (ctx.play.storyEvents === "tier0") return null; // no participation
    if (!("era" in event) || !event.era) return null; // proto era — not modelled, pays nothing
    const row = ctx.config.reward_maps[`story-${event.era}`]?.[ctx.play.storyEvents];
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

export const playLeagueOfHeroes = gradedStamp({
  id: "play.league-of-heroes",
  claims: ["leagueofheroes"],
  row(ctx) {
    const label = LEAGUE_OF_HEROES_LABELS[ctx.play.leagueOfHeroes as LeagueOfHeroesKey];
    if (!label) return null;
    const row = ctx.config.reward_maps["league-of-heroes"]?.[label];
    return row ? flatPayload(row) : null;
  },
});

export const playStrongestTeam = gradedStamp({
  id: "play.strongest-team",
  claims: ["strongestteam"],
  row(ctx) {
    if (ctx.play.strongestTeam === "off") return null;
    const baseline = ctx.config.reward_structures["strongest-team"];
    const rank = ctx.config.reward_maps["strongest-team"]?.[ctx.play.strongestTeam];
    return addPayloads(baseline ? flatPayload(baseline) : null, rank ? flatPayload(rank) : null);
  },
});

export const playMastersChallenge = gradedStamp({
  id: "play.masters-challenge",
  claims: ["masterschallenge"],
  row(ctx) {
    if (ctx.play.masters === "off") return null;
    const row = ctx.config.reward_maps["masters"]?.[ctx.play.masters as MastersKey];
    return row ? flatPayload(row) : null;
  },
});
