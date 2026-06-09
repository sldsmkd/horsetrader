/**
 * The commit-shield view-model: `(bundle, bannerKey, inputs) → CommitContext`.
 * The shield is a **banner dossier with a planning attachment** (docs/frontend/ui.md
 * "the plan"; commitShield.ts): it answers *what am I pulling for* (artwork +
 * featured cards) before *what will it cost* (the resource impact). This pure
 * selector resolves one banner to that data — identity, the featured-card atoms
 * with their art, and the **predicted-available** resources the reservation draws
 * on — plus the gacha constants the shield needs to turn a committed **pity**
 * (principle 10) into a reserved pull/carat cost.
 *
 * Data-only: no display strings (the view labels + formats). The reservation
 * "after" is computed *in the shield*, reactive to the pity stepper, so the
 * selector exposes only the pre-commitment balances and the constants.
 */

import type { Bundle } from "../bundle/access.ts";
import type { ResourceVector, Commitments } from "../../core/persistence/document.ts";
import { atomOf, type BannerAtom, type BannerKind, type RarityTier } from "./aboveLane.ts";

/** Featured-card sort: hero rarity bands first (crystal → gold), then alpha within
 *  a band — so the highest-rarity pickups lead from the left. */
const RARITY_RANK: Record<RarityTier, number> = { crystal: 0, gold: 1 };

/** A featured-card atom for the dossier grid — a `BannerAtom` plus its card art. */
export interface CommitAtom extends BannerAtom {
  /** The support/trainee card thumbnail (academy art); "" if the bake lacks one. */
  image: string;
}

/** Everything the commit shield renders and writes against, for one banner. */
export interface CommitContext {
  bannerKey: string;
  kind: BannerKind;
  /** Banner run, calendar-mapped — the view formats the range (into the title). */
  start: string;
  end: string;
  /** The featured cards (R/1★ culled, like the banner readout). */
  atoms: CommitAtom[];
  /** Predicted-available resources at the banner date — the reservation's source. */
  freeCarats: number;
  paidCarats: number;
  /** The scout tickets that apply to *this* banner kind (support vs trainee). */
  tickets: number;
  /** The currently committed pity, or null when nothing is committed yet. */
  committedPity: number | null;
  /** Pulls per guaranteed pity — the spark threshold (`pulls = pity × this`). */
  sparkThreshold: number;
  /** Carat cost of one pull — the substrate the reservation reads in. */
  caratsPerPull: number;
}

/** The two live reads the shield folds in, mirroring `AboveLaneInputs`. */
export interface CommitInputs {
  balanceAt: (date: string) => ResourceVector;
  commitments: Commitments;
}

export function commitContext(bundle: Bundle, bannerKey: string, inputs: CommitInputs): CommitContext {
  const ev = bundle.event(bannerKey);
  // The shield is only ever spawned from a banner readout — resolve-or-throw, the
  // same trust-the-bake stance as the lookups: a non-banner key here is a wiring bug.
  if (ev.type !== "trainee" && ev.type !== "support") throw new Error(`commit: "${bannerKey}" is not a banner (${ev.type})`);
  const kind: BannerKind = ev.type;
  const { carats_per_pull: caratsPerPull, spark_threshold: sparkThreshold } = bundle.config().gacha;
  const v = inputs.balanceAt(ev.start);

  const atoms = ev.contents
    .map((id): CommitAtom | null => {
      const atom = atomOf(bundle, kind, id);
      if (!atom) return null;
      const thumbnail = kind === "support" ? bundle.support(id).thumbnail : bundle.trainee(id).thumbnail;
      return { ...atom, image: thumbnail ?? "" };
    })
    .filter((a): a is CommitAtom => a !== null)
    .sort((a, b) => RARITY_RANK[a.rarityTier] - RARITY_RANK[b.rarityTier] || a.name.localeCompare(b.name));

  return {
    bannerKey,
    kind,
    start: ev.start,
    end: ev.end,
    atoms,
    freeCarats: v.free_carats ?? 0,
    paidCarats: v.paid_carats ?? 0,
    // The kind-appropriate scout ticket: a support banner draws support tickets, a
    // trainee banner trainee tickets (the other kind can't be spent here).
    tickets: (kind === "support" ? v.support_tickets : v.trainee_tickets) ?? 0,
    committedPity: inputs.commitments[bannerKey] ?? null,
    sparkThreshold,
    caratsPerPull,
  };
}

/**
 * The worst-case reservation a committed pity carves out of the predicted balance —
 * the **before → after** the Resource Impact section reports (informational, never a
 * validator: overcommitment is allowed, so an exhausted resource just floors at 0).
 * Pulls are reserved in spend order — scout tickets first (1 pull each), then paid
 * carats, then free carats — so the cheapest-to-replace currency drains last.
 */
export interface ReservedBalance {
  freeCarats: number;
  paidCarats: number;
  tickets: number;
}

export function reserve(ctx: CommitContext, pity: number): ReservedBalance {
  let pulls = Math.max(0, pity) * ctx.sparkThreshold;

  const ticketsUsed = Math.min(ctx.tickets, pulls);
  pulls -= ticketsUsed;

  let caratsNeeded = pulls * ctx.caratsPerPull;
  const paidUsed = Math.min(ctx.paidCarats, caratsNeeded);
  caratsNeeded -= paidUsed;
  const freeUsed = Math.min(ctx.freeCarats, caratsNeeded);

  return {
    freeCarats: ctx.freeCarats - freeUsed,
    paidCarats: ctx.paidCarats - paidUsed,
    tickets: ctx.tickets - ticketsUsed,
  };
}
