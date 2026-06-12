/**
 * GradedStamp — the shared claimer rule (eclipse/2.DESIGN.md): return own
 * claimed events priced by a play-selected `reward_maps` row. `row(ctx, event)`
 * is the sole varying part — CM's map key is fixed, stories' reads the event's
 * era, training-pass's is a binary subscription row. A null row means nothing
 * to stamp (CM at `skip`, a proto-era story, an unsubscribed pass): the event
 * passes through with its baked face, never leaves the lane — grading is the
 * FACE lever, presence is `enabled` (eclipse/4.REGISTRY.md).
 *
 * Occupants today: champions-meeting, story, training-pass. The parked PvP trio
 * (#61: league-of-heroes, strongest-team, masters-challenge) are 4–6.
 */

import type { ResourceVector } from "../../projection/ledger.ts";
import type { BakedEvent, SettledEvent, Stream, StreamCtx } from "../stream.ts";
import { settle } from "./settle.ts";

export interface GradedStampSpec {
  id: string;
  /** The claimed event types (the bake's taxonomy — see 4.REGISTRY derivation 1). */
  claims: readonly string[];
  /** The priced row for one event, or null when there is nothing to stamp. */
  row(ctx: StreamCtx, event: BakedEvent): ResourceVector | null;
}

/** Build a GradedStamp claimer: always enabled (presence is universal; the row
 *  is the play/subscription lever), settling each owned record with its row. */
export function gradedStamp(spec: GradedStampSpec): Stream {
  return {
    id: spec.id,
    claims: spec.claims,
    mints: [],
    enabled: () => true,
    events(ctx): SettledEvent[] {
      return ctx.owned.flatMap((record) => settle(record, ctx, spec.row(ctx, record) ?? undefined));
    },
  };
}
