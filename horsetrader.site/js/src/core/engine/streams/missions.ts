/**
 * `play.missions` — the regular limited-mission campaigns, a binary opt-in
 * population (project_mission_model): the player either does the grindy
 * missions or doesn't. The claim is the `mission` TYPE only — anniversary and
 * scenario missions are separate types and ride the complement into
 * `ground.events`, universal and never gated.
 *
 * This is the registry's one presence-gated claimer: when `play.missions` is
 * "no", the gate drops the whole stream and its 161 events leave the settled
 * world — off the ledger AND off the lane (the old `hiddenKinds` UI hack now
 * falls out of the model by construction). Claims are static either way: a
 * disabled stream's types never re-route to the complement.
 */

import type { Stream } from "../stream.ts";
import { settleAll } from "../rules/settle.ts";

export const playMissions: Stream = {
  id: "play.missions",
  claims: ["mission"],
  mints: [],
  enabled: (ctx) => ctx.play.missions === "yes",
  events: settleAll,
};
