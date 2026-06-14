/**
 * `ground.events` — the universal ground truth: the complement claimer. Every
 * baked event type no other stream claims routes here. The bankable passive
 * event types have dedicated streams; this remains the catch-all for anchor and
 * non-bankable records. Config/play-agnostic by construction: it settles each
 * record as baked — discrete face plus compound-facet children — and nothing
 * else. The only user input that ever touches its money is `rushed`, and that
 * lives in the FOLD (payment timing is unwritable in streams).
 */

import type { Stream } from "../stream.ts";
import { settleAll } from "../rules/settle.ts";

export const groundEvents: Stream = {
  id: "ground.events",
  claims: "complement",
  mints: [],
  enabled: () => true,
  events: settleAll,
};
