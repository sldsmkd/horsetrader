/**
 * The training-pass channel: the **premium track** of the Training Pass battle-pass,
 * a paid-money toggle in the same "dolphin" family as the Daily Carat Pack. Each
 * Training Pass event already pays its **free track** through the ground-truth
 * `events` channel (the `rewards` baked on the record — everyone gets it). This
 * channel adds the *premium boost* on top, but only while the player owns the
 * premium track: a single account-level toggle, no per-event input.
 *
 * The boost is the same haul on every event — the binary `reward_maps["training-pass"]
 * ["premium"]` row (1000 free + 350 paid carats + 2/2 tickets + 1 rainbow shard) — so
 * unlike the rank-graded income channels there is no row to *select*; the toggle just
 * decides whether the one row applies. It lands on each event's `end`, the same instant
 * the free track posts (see events.ts), so free + premium fold onto the same day.
 *
 * Like every income channel the value comes from the bake, never a literal here, and
 * only payouts strictly after the snapshot (`after`) emit. The attribution `source` is
 * the event's own key — the same convention the free track uses — so the boost stays
 * tied to the specific Training Pass instance rather than the (eventless) map key.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { Config } from "../../persistence/document.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, dateStringInTimeZone } from "../dates.ts";
import { flatPayload } from "./rewardmap.ts";

/** The baked `reward_maps` key carrying the Training Pass boost, and the binary label. */
const TRAINING_PASS_MAP = "training-pass";
const PREMIUM_LABEL = "premium";

/**
 * Whether the player owns the Training Pass premium track. A `true` in
 * `config.trainingPass` *is* the subscription (its presence enables the channel);
 * anything else means free-track only. The single source of that precedence,
 * mirroring `resolveDailyPack`.
 */
export function resolveTrainingPass(config: Config | undefined): boolean {
  return config?.["trainingPass"] === true;
}

/**
 * Emit the premium boost on each Training Pass event's `end`, while `premium` is on.
 * Inert when the toggle is off or the baked `reward_maps["training-pass"]["premium"]`
 * row is missing/empty. Only events landing strictly after `after` emit (earlier ones
 * are already baked into the snapshot reading).
 */
export function trainingPassStream(
  bundle: EventsBundle,
  config: ConfigBundle,
  premium: boolean,
  after: CalendarDate,
  timeZone: string = UTC_TIME_ZONE,
): StreamEmission[] {
  if (!premium) return [];
  const row = config.reward_maps[TRAINING_PASS_MAP]?.[PREMIUM_LABEL];
  if (!row) return [];
  const payload = flatPayload(row);
  if (Object.keys(payload).length === 0) return [];

  const emissions: StreamEmission[] = [];
  for (const event of bundle.events) {
    if (event.type !== "trainingpass") continue;
    const date = dateStringInTimeZone(event.end, timeZone);
    if (date <= after) continue;
    emissions.push({ date, source: event.key, deltas: { ...payload } });
  }
  return emissions;
}
