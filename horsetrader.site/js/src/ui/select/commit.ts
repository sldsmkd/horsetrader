/**
 * The commit-dossier view-model: `(bundle, bannerKey, inputs) → CommitContext`.
 * The modal is a **banner dossier with a planning attachment** (docs/frontend/ui.md
 * "the plan"; commitDossier.ts): it answers *what am I pulling for* (artwork +
 * featured cards) before *what will it cost* (the resource impact). This pure
 * selector resolves one banner to that data — identity, the featured-card atoms
 * with their art, and the **predicted-available** resources the reservation draws
 * on — plus the gacha constants the modal needs to turn a committed **pity**
 * (principle 10) into a reserved pull/carat cost.
 *
 * Data-only: no display strings (the view labels + formats). The reservation
 * "after" is computed *in the modal*, reactive to the pity stepper, so the
 * selector exposes only the pre-commitment balances and the constants.
 */

import type { Bundle } from "../bundle/access.ts";
import type { ResourceVector, Commitments } from "../../core/persistence/document.ts";
import { commitmentPity, commitmentUsePaid } from "../../core/persistence/document.ts";
import { atomOf, type BannerAtom, type BannerKind, type RarityTier } from "./aboveLane.ts";
import { remainingAfterSpend, bannerDays, bannerPullSources, type PullSources } from "../../core/projection/pulls.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { ForecastInput } from "./forecast.ts";

/** Featured-card sort: hero rarity bands first (crystal → gold → silver), then alpha within
 *  a band — so the highest-rarity pickups lead from the left. */
const RARITY_RANK: Record<RarityTier, number> = { crystal: 0, gold: 1, silver: 2 };

/** A featured-card atom for the dossier grid — a `BannerAtom` plus its card art. */
export interface CommitAtom extends BannerAtom {
  /** The support/trainee card thumbnail (academy art); "" if the bake lacks one. */
  image: string;
}

/** Everything the commit dossier renders and writes against, for one banner. */
export interface CommitContext {
  bannerKey: string;
  kind: BannerKind;
  /** Banner run, calendar-mapped — the view formats the range (into the title). */
  start: string;
  end: string;
  /** The featured cards (R/1★ culled, like the banner readout). */
  atoms: CommitAtom[];
  /** Predicted-available resources measured at the banner's **end** (project_spend_model:
   *  the whole snapshot is taken at `ev.end`, where every accruing source has settled). */
  freeCarats: number;
  paidCarats: number;
  /** The scout tickets that apply to *this* banner kind (support vs trainee). */
  tickets: number;
  /** This banner's own free-pull grant — spent first, banner-local (never banked). */
  freePulls: number;
  /** Banner duration in days — caps the daily paid pulls (one per day). */
  bannerDays: number;
  /** The currently committed pity, or null when nothing is committed yet. */
  committedPity: number | null;
  /** Whether the stored commitment opts into spending paid carats at full price (#65). */
  committedUsePaid: boolean;
  /** Pulls per guaranteed pity — the spark threshold (`pulls = pity × this`). */
  sparkThreshold: number;
  /** Carat cost of one full-price pull — the free-carat substrate the reservation reads. */
  caratsPerPull: number;
  /** Paid carats per daily discount pull (`gacha.paid_daily_pull`, 50). */
  paidDailyPull: number;
  /** Per-pull rate of landing the **forecast target** (the highest-tier featured
   *  card, banner override or tier default) — the Forecast widget's binomial p. */
  featuredRate: number;
  /** The copies cap a copy stops mattering past — MLB (support) / 5★ (trainee). */
  maxCopies: number;
}

/** Max useful copies of a target: a support card's MLB and a trainee's 5★ are both
 *  five copies, after which another is dead weight — the Forecast distribution's cap. */
const MAX_COPIES = 5;

/** The per-pull rate the Forecast models against: the player sparks/pulls for one
 *  target, so take the **highest-tier** featured card (the SSR/3★ you'd pick) and read
 *  its rate — a banner-local override if present, else the tier default. Ties at the
 *  top tier resolve to the best rate (the most favourable single target). */
function featuredRate(ev: { rate_overrides?: Record<string, number> }, atoms: readonly { id: string; rarityTier: RarityTier }[], defaults: Record<string, number>): number {
  const topTier: RarityTier = atoms.some((a) => a.rarityTier === "crystal") ? "crystal" : "gold";
  const overrides = ev.rate_overrides ?? {};
  const rates = atoms.filter((a) => a.rarityTier === topTier).map((a) => overrides[a.id] ?? defaults[topTier] ?? 0);
  return rates.length ? Math.max(...rates) : 0;
}

/** The per-banner forecast parameters — everything the outcome distribution needs
 *  *except* the committed pity (which the caller supplies): the spark threshold, the
 *  top-tier featured rate, and the copy cap (MLB / 5★). */
export type ForecastBase = Omit<ForecastInput, "pity">;

/** Assemble a banner's forecast parameters from the bundle — shared by the commit
 *  dossier and the Desk's per-row forecast so the two model identical odds. The
 *  committed pity is folded in by the caller (`{ ...bannerForecast(...), pity }`).
 *  Resolve-or-throw on a non-banner key, the trust-the-bake stance of the lookups. */
export function bannerForecast(bundle: Bundle, bannerKey: string): ForecastBase {
  const ev = bundle.event(bannerKey);
  if (ev.type !== "trainee" && ev.type !== "support") throw new Error(`bannerForecast: "${bannerKey}" is not a banner (${ev.type})`);
  const { spark_threshold: sparkThreshold, featured_rates } = bundle.config().gacha;
  const atoms = ev.contents
    .map((id) => atomOf(bundle, ev.type, id))
    .filter((a): a is BannerAtom => a !== null);
  return { pullsPerPity: sparkThreshold, featuredRate: featuredRate(ev, atoms, featured_rates), maxCopies: MAX_COPIES };
}

/** The two live reads the modal folds in, mirroring `AboveLaneInputs`. */
export interface CommitInputs {
  balanceAt: (date: CalendarDate) => ResourceVector;
  commitments: Commitments;
}

export function commitContext(bundle: Bundle, bannerKey: string, inputs: CommitInputs): CommitContext {
  const ev = bundle.event(bannerKey);
  // The modal is only ever spawned from a banner readout — resolve-or-throw, the
  // same trust-the-bake stance as the lookups: a non-banner key here is a wiring bug.
  if (ev.type !== "trainee" && ev.type !== "support") throw new Error(`commit: "${bannerKey}" is not a banner (${ev.type})`);
  const kind: BannerKind = ev.type;
  const { carats_per_pull: caratsPerPull, spark_threshold: sparkThreshold, paid_daily_pull: paidDailyPull, featured_rates } = bundle.config().gacha;
  // Measured at the banner's END, not its start — every accruing source (income, daily
  // pulls, free pulls, tickets) has settled by then (project_spend_model).
  const v = inputs.balanceAt(ev.end);
  const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
  const commitment = inputs.commitments[bannerKey];
  const committedPity = commitment == null ? null : commitmentPity(commitment);
  const committedUsePaid = commitment == null ? false : commitmentUsePaid(commitment);

  const atoms = ev.contents
    .map((id): CommitAtom | null => {
      const atom = atomOf(bundle, kind, id);
      if (!atom) return null;
      const thumbnail = kind === "support" ? bundle.support(id).thumbnail : bundle.trainee(id).thumbnail;
      return { ...atom, image: thumbnail ?? "" };
    })
    .filter((a): a is CommitAtom => a !== null)
    .sort((a, b) => RARITY_RANK[a.rarityTier] - RARITY_RANK[b.rarityTier] || a.name.localeCompare(b.name));

  // The kind-narrowed spend sources off this banner's measured balance — the shared
  // assembly (the other kind's tickets can't be spent here).
  const sources = bannerPullSources(v, kind, freePulls);
  return {
    bannerKey,
    kind,
    start: ev.start,
    end: ev.end,
    atoms,
    freeCarats: sources.freeCarats,
    paidCarats: sources.paidCarats,
    tickets: sources.tickets,
    freePulls,
    bannerDays: bannerDays(ev.start, ev.end),
    committedPity,
    committedUsePaid,
    sparkThreshold,
    caratsPerPull,
    paidDailyPull,
    featuredRate: featuredRate(ev, atoms, featured_rates),
    maxCopies: MAX_COPIES,
  };
}

/**
 * The reservation a committed pity carves out of the predicted balance — the **before →
 * after** the Resource Impact section reports (informational, never a validator:
 * overcommitment is allowed). Pulls are covered **cheapest-first** under the spend model
 * (project_spend_model), sharing `pullCapacity` with the card readout so the two agree:
 *   1. free pulls (banner-local — reduce the need, not a balance line),
 *   2. tickets (1 pull each),
 *   3. daily paid pulls (50 paid carats each, duration-capped),
 *   4. free carats (150 each) — the full-price remainder.
 * Tickets bottom out at 0. With `usePaid` off, paid carats only ever spend through the
 * daily window (any the cap can't absorb stay banked) and **free carats absorb the whole
 * leftover and go negative**. With `usePaid` on (#65), owned paid carats spend at full
 * price after free carats floor at their `< 150` remainder, and only the still-unmet need
 * surges free carats negative. Either way an overcommitment reads as a negative carat
 * balance (the view reds it).
 */
export type ReservedBalance = PullSources;

export function reserve(ctx: CommitContext, pity: number, usePaid: boolean): ReservedBalance {
  return remainingAfterSpend(
    { freePulls: ctx.freePulls, tickets: ctx.tickets, freeCarats: ctx.freeCarats, paidCarats: ctx.paidCarats },
    { caratsPerPull: ctx.caratsPerPull, paidDailyPull: ctx.paidDailyPull, bannerDays: ctx.bannerDays },
    ctx.sparkThreshold,
    pity,
    usePaid,
  );
}
