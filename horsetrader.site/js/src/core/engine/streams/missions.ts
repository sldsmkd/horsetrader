/**
 * `event.missions` — the regular limited-mission campaigns, a binary opt-in
 * population (project_mission_model): the player either does the grindy
 * missions or doesn't. The claim is the `mission` TYPE only — anniversary and
 * scenario missions are separate passive-event streams, universal and never
 * gated.
 *
 * This is a presence-gated claimer: when `event.missions` is off, the gate
 * drops the whole stream and its 161 events leave the settled
 * world — off the ledger AND off the lane (the old `hiddenKinds` UI hack now
 * falls out of the model by construction). Claims are static either way: a
 * disabled stream's types never re-route to the complement.
 */

import type { Stream } from "../stream.ts";
import { settleAll } from "../rules/settle.ts";

export const eventMissions: Stream = {
  id: "event.missions",
  claims: ["mission"],
  mints: [],
  enabled: (ctx) => ctx.play.missions === "on",
  events: settleAll,
};
