/**
 * The settlement rule: how a claimer turns one baked record into its settled
 * events. An owner settles ALL of its events' facets (eclipse/4.REGISTRY.md
 * derivation 2):
 *
 *   - the event itself — visible (unless the bake opted it out), its face the
 *     numeric discrete rewards (plus any stamped row), excluding `pulls`
 *     (banner-scoped, never banked) and the compound shapes;
 *   - one minted `visible:false` cadence child per payout day of each compound
 *     facet (`generator` / `sequence`), keyed under the parent
 *     (`<parent-key>-<date>`) — on the ledger, off the lane.
 *
 * This dissolves the old generator/sequence channels: the expansion is
 * stream-private business logic applied by whichever stream owns the record,
 * never a separate stream. The complete cadence is retained in the settled
 * world so the lane can show the event's gross payout; the fold applies the
 * snapshot boundary when deriving the forward projection.
 */

import type { ResourceVector } from "../../projection/ledger.ts";
import { addDays, dateStringInTimeZone } from "../../projection/dates.ts";
import type { BakedEvent, SettledEvent, StreamCtx } from "../stream.ts";

/** The discrete face: numeric rewards, minus `pulls`, plus the stamped row. */
function face(record: BakedEvent, stamp?: ResourceVector): ResourceVector {
  const out: ResourceVector = {};
  for (const [key, value] of Object.entries(record.rewards ?? {})) {
    if (typeof value !== "number") continue; // compound facet — expanded into children
    if (key === "pulls") continue; // banner-scoped free pulls — read at the banner, never banked
    out[key] = (out[key] ?? 0) + value;
  }
  for (const [key, value] of Object.entries(stamp ?? {})) {
    out[key] = (out[key] ?? 0) + value;
  }
  return out;
}

/** Expand the compound facets into minted per-day children under the parent key. */
function children(record: BakedEvent, ctx: StreamCtx): SettledEvent[] {
  const out: SettledEvent[] = [];
  const start = dateStringInTimeZone(record.start, ctx.timeZone);

  const generator = record.rewards?.generator;
  if (typeof generator === "object" && typeof generator["repeat"] === "number") {
    const payload: ResourceVector = {};
    for (const [key, value] of Object.entries(generator)) {
      if (key === "repeat" || typeof value !== "number") continue;
      payload[key] = value;
    }
    if (Object.keys(payload).length) {
      for (let day = 0; day < generator["repeat"]; day++) {
        const date = addDays(start, day);
        out.push({ key: `${record.key}-${date}`, type: record.type, start: date, end: date, rewards: { ...payload }, visible: false, record: null });
      }
    }
  }

  const sequence = record.rewards?.sequence;
  if (typeof sequence === "object" && typeof sequence["type"] === "string" && Array.isArray(sequence["sequence"])) {
    const resource = sequence["type"];
    sequence["sequence"].forEach((amount, day) => {
      if (typeof amount !== "number") return; // null = unpaid that day (absence, not zero)
      const date = addDays(start, day);
      out.push({ key: `${record.key}-${date}`, type: record.type, start: date, end: date, rewards: { [resource]: amount }, visible: false, record: null });
    });
  }

  return out;
}

/**
 * Settle one baked record: the visible event (face resolved, optionally
 * stamped) plus its compound-facet children. The bake's `visible: false` is
 * the existing opt-out and is honoured as-is.
 */
export function settle(record: BakedEvent, ctx: StreamCtx, stamp?: ResourceVector): SettledEvent[] {
  const parent: SettledEvent = {
    key: record.key,
    type: record.type,
    start: dateStringInTimeZone(record.start, ctx.timeZone),
    end: dateStringInTimeZone(record.end, ctx.timeZone),
    rewards: face(record, stamp),
    visible: record.visible !== false,
    record,
  };
  return [parent, ...children(record, ctx)];
}

/** Settle every owned record, unstamped — the plain pass-through claimer body. */
export function settleAll(ctx: StreamCtx): SettledEvent[] {
  return ctx.owned.flatMap((record) => settle(record, ctx));
}
