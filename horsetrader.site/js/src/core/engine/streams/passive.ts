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

export const eventAnniversaryMissions = passiveEventStream("event.anniversary-missions", "anniversarymission", (ctx) => ctx.play.anniversaryMissions === "on");
export const eventFactorStudies = passiveEventStream("event.factor-studies", "factorstudies", (ctx) => ctx.play.factorStudies === "on");
export const eventHolidays = passiveEventStream("event.holidays", "holiday", (ctx) => ctx.play.holidays === "on");
export const eventLegendRaces = passiveEventStream("event.legend-races", "legendrace", (ctx) => ctx.play.legendRaces === "on");
export const eventRacingCarnival = passiveEventStream("event.racing-carnival", "racingcarnival", (ctx) => ctx.play.racingCarnival === "on");
export const eventScenarioMissions = passiveEventStream("event.scenario-missions", "scenariomission", (ctx) => ctx.play.scenarioMissions === "on");
export const eventShowtime = passiveEventStream("event.showtime", "showtime", (ctx) => ctx.play.showtime === "on");
export const eventSkillTests = passiveEventStream("event.skill-tests", "skilltest", (ctx) => ctx.play.skillTests === "on");
export const eventTraineeDebuts = passiveEventStream("event.trainee-debuts", "trainee", (ctx) => ctx.play.traineeDebuts === "on");
