/**
 * The registry: the one declaration shape, fully adopted, no exceptions
 * (eclipse/OVERVIEW.md). Construction asserts the partition — an ill-formed
 * registry fails to BUILD, not to fold:
 *
 *   1. Claim disjointness — no event type claimed twice; exactly one
 *      complement claimer. Double-pay is a constructor-time impossibility.
 *   2. Mint fencing — minted key prefixes pairwise disjoint and colliding
 *      with no baked key — so a minted key can never shadow a baked one.
 *
 * That's all. No ordering (streams commute under the linear fold), no
 * capability classes, no introspection. Routing is the registry's other
 * mechanical duty: slice the bundle by the declared claims so each stream's
 * `events(ctx)` receives its owned records (`ctx.owned`) and no stream
 * re-implements the partition. See eclipse/4.REGISTRY.md.
 */

import type { EventsBundle } from "../bundle/events.gen.ts";
import type { BakedEvent, Stream } from "./stream.ts";
import { groundEvents } from "./streams/ground.ts";
import { eventMissions } from "./streams/missions.ts";
import {
  playChampionsMeeting,
  playLeagueOfHeroes,
  playMastersChallenge,
  playStory,
  playStrongestTeam,
  subscriptionTrainingPass,
} from "./streams/graded.ts";
import {
  identityClubRank,
  playDailies,
  playShopTickets,
  playTeamTrials,
  playWeeklyLogin,
  subscriptionDailyPack,
} from "./streams/synthesised.ts";
import {
  eventAnniversaryMissions,
  eventFactorStudies,
  eventHolidays,
  eventLegendRaces,
  eventMainStory,
  eventRacingCarnival,
  eventScenarioMissions,
  eventShowtime,
  eventSkillTests,
  eventTraineeDebuts,
} from "./streams/passive.ts";

/** A validated registry: the streams plus the routing the assertions proved sound. */
export interface Registry {
  streams: readonly Stream[];
  /** The baked records each stream's claims route to it, by stream id. */
  route(bundle: EventsBundle): Map<string, BakedEvent[]>;
}

/** Every stream the engine folds by default — the full roster of 4.REGISTRY. */
export const DEFAULT_STREAMS: readonly Stream[] = [
  groundEvents,
  eventAnniversaryMissions,
  eventFactorStudies,
  eventHolidays,
  eventLegendRaces,
  eventMainStory,
  eventRacingCarnival,
  eventScenarioMissions,
  eventShowtime,
  eventSkillTests,
  eventTraineeDebuts,
  eventMissions,
  playChampionsMeeting,
  playStory,
  subscriptionTrainingPass,
  playLeagueOfHeroes,
  playStrongestTeam,
  playMastersChallenge,
  playDailies,
  playWeeklyLogin,
  playTeamTrials,
  identityClubRank,
  playShopTickets,
  subscriptionDailyPack,
];

/**
 * Assert the partition and return the routable registry. Throws on any
 * violation — these are programming errors in the stream declarations, never
 * data conditions to tolerate.
 */
export function buildRegistry(streams: readonly Stream[], bundle: EventsBundle): Registry {
  // 1. Claim disjointness + exactly one complement claimer.
  const owners = new Map<string, string>(); // claimed type → stream id
  let complement: string | null = null;
  const ids = new Set<string>();
  for (const stream of streams) {
    if (ids.has(stream.id)) throw new Error(`registry: duplicate stream id "${stream.id}"`);
    ids.add(stream.id);
    if (stream.claims === "complement") {
      if (complement !== null) throw new Error(`registry: two complement claimers ("${complement}", "${stream.id}")`);
      complement = stream.id;
      continue;
    }
    for (const type of stream.claims) {
      const prior = owners.get(type);
      if (prior !== undefined) throw new Error(`registry: type "${type}" claimed by both "${prior}" and "${stream.id}"`);
      owners.set(type, stream.id);
    }
  }
  if (complement === null) throw new Error("registry: no complement claimer — unclaimed baked events would be unrouted");

  // 2. Mint fencing — prefixes pairwise disjoint and absent from the bake.
  const mints: [string, string][] = streams.flatMap((s) => s.mints.map((m): [string, string] => [m, s.id]));
  for (let i = 0; i < mints.length; i++) {
    for (let j = i + 1; j < mints.length; j++) {
      const [a] = mints[i]!;
      const [b] = mints[j]!;
      if (a.startsWith(b) || b.startsWith(a)) {
        throw new Error(`registry: overlapping mint prefixes "${a}" (${mints[i]![1]}) and "${b}" (${mints[j]![1]})`);
      }
    }
  }
  for (const event of bundle.events) {
    for (const [prefix, id] of mints) {
      if (event.key.startsWith(prefix)) {
        throw new Error(`registry: mint prefix "${prefix}" (${id}) collides with baked key "${event.key}"`);
      }
    }
  }

  const complementId = complement;
  return {
    streams,
    route(b: EventsBundle): Map<string, BakedEvent[]> {
      const routed = new Map<string, BakedEvent[]>(streams.map((s) => [s.id, []]));
      for (const event of b.events) {
        const owner = owners.get(event.type) ?? complementId;
        routed.get(owner)!.push(event);
      }
      return routed;
    },
  };
}
