/**
 * Shared selector for the *graded* income channels (team-trials, club-rank): pull
 * the numeric payload off a baked `reward_maps` row into a `ResourceVector`. The
 * row carries only carats/ticket counts today, but stays defensive — any non-number
 * field (a future label/flag) is dropped, never coerced. See docs/frontend/glue.md.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { ResourceVector } from "../ledger.ts";

/** Pull the numeric payload off a baked reward-map row (`{free_carats: 300}`). */
export function flatPayload(row: ConfigBundle["reward_maps"][string][string]): ResourceVector {
  const payload: ResourceVector = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "number") payload[key] = value;
  }
  return payload;
}
