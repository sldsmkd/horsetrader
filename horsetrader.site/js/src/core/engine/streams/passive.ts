/**
 * Passive event-income claimers. These are baked event types whose rewards are
 * already authored by the ETL; the stream only gives each type its own economy
 * attribution bucket instead of hiding it inside `ground.events`.
 */

import type { Stream } from "../stream.ts";
import { settleAll } from "../rules/settle.ts";

function passiveEventStream(id: string, type: string, enabled: Stream["enabled"] = () => true): Stream {
  return {
    id,
    claims: [type],
    mints: [],
    enabled,
    events: settleAll,
  };
}

// Main-story chapters are permanent story content with no deadline — everyone has
// (or will) clear them, so the stream is ALWAYS enabled and carries no play gate.
// The baked face (the flattened story-clear carats) settles as-is, in its own bucket
// rather than hiding inside `ground.events`.
export const eventMainStory = passiveEventStream("event.main-story", "mainstory");
export const eventAnniversaryMissions = passiveEventStream("event.anniversary-missions", "anniversarymission", (ctx) => ctx.play.anniversaryMissions === "on");
export const eventFactorStudies = passiveEventStream("event.factor-studies", "factorstudies", (ctx) => ctx.play.factorStudies === "on");
export const eventHolidays = passiveEventStream("event.holidays", "holiday", (ctx) => ctx.play.holidays === "on");
export const eventLegendRaces = passiveEventStream("event.legend-races", "legendrace", (ctx) => ctx.play.legendRaces === "on");
export const eventRacingCarnival = passiveEventStream("event.racing-carnival", "racingcarnival", (ctx) => ctx.play.racingCarnival === "on");
export const eventScenarioMissions = passiveEventStream("event.scenario-missions", "scenariomission", (ctx) => ctx.play.scenarioMissions === "on");
export const eventShowtime = passiveEventStream("event.showtime", "showtime", (ctx) => ctx.play.showtime === "on");
export const eventSkillTests = passiveEventStream("event.skill-tests", "skilltest", (ctx) => ctx.play.skillTests === "on");
// Trainee banners are pull targets the user commits pity against, so the stream
// is ALWAYS enabled — you can't toggle a committed banner off the lane (reconcile
// would orphan the claim). The `traineeDebuts` play setting is a *completeness*
// lever over the incidental 80-carat debut income these banners sometimes hold:
// off keeps the banner present but blanks its face so that income isn't counted.
export const eventTraineeDebuts: Stream = {
  id: "event.trainee-debuts",
  claims: ["trainee"],
  mints: [],
  enabled: () => true,
  events: (ctx) =>
    ctx.play.traineeDebuts === "on" ? settleAll(ctx) : settleAll(ctx).map((ev) => ({ ...ev, rewards: {} })),
};
