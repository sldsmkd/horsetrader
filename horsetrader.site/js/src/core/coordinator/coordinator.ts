/**
 * The coordinator: the thin, headless seam that joins persistence (the user's
 * stored inputs) to projection (the derived ledger + balance series). It loads
 * the plan, builds the channels from the bundle, folds the enabled ones, and
 * recomputes whenever an input or a toggle changes. It knows nothing about the
 * DOM — the UI drives it through this surface and reads the result. See
 * docs/frontend/persistence.md (the "thin coordinator" note) and
 * docs/frontend/projection.md.
 *
 * Two kinds of state, deliberately separate:
 *   - The **plan** (snapshot/config/commitments/favourites) is persisted user
 *     input; mutating it saves and recomputes.
 *   - **Toggles** are ephemeral dev/debug isolation (hide a channel's
 *     contribution); they recompute but are never persisted into the plan.
 *
 * Recompute is the documented full scan: build a fresh immutable `Projection`
 * and swap it. Scrubbing reads the cached `series`, never recomputing.
 */

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import { resolveClubRank } from "../identity/clubrank.ts";
import { resolvePlayStyle } from "../playstyle/index.ts";
import type { PlanDocument } from "../persistence/index.ts";
import { load, save } from "../persistence/index.ts";
import type { KeyValueStore } from "../persistence/storage.ts";
import { defaultStore } from "../persistence/storage.ts";
import { applyChampionsMeetingRewards, project, spendStream } from "../projection/index.ts";
import type { Projection, ResourceVector, SpendGacha, CommittedBanner, BannerKind } from "../projection/index.ts";
import { UTC_TIME_ZONE, cal, dateStringInTimeZone } from "../projection/dates.ts";
import type { CalendarDate } from "../projection/dates.ts";
import { DEFAULT_CHANNELS } from "./channels.ts";
import type { ChannelDef } from "./channels.ts";

/** The committed banners the spend pass resolves: every banner with a positive pity in
 *  the plan, paired with the run/grant details the debit math needs. The run instants are
 *  bucketed to **calendar dates** in the projection's timezone (exactly as `eventStream`
 *  buckets `event.end`) so the spend emission lands in the same date-space as the income
 *  series — otherwise its date matches no bucket and the lookup falls through. */
function committedBanners(bundle: EventsBundle, commitments: Record<string, number>, timeZone: string): CommittedBanner[] {
  const banners: CommittedBanner[] = [];
  for (const ev of bundle.events) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    const pity = commitments[ev.key];
    if (!pity) continue; // unset or 0 — no spend to resolve
    const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
    banners.push({
      key: ev.key,
      kind: ev.type as BannerKind,
      start: dateStringInTimeZone(ev.start, timeZone),
      end: dateStringInTimeZone(ev.end, timeZone),
      freePulls,
      pity,
    });
  }
  return banners;
}

/** The persisted plan sections a UI mutator can patch (never `version`). */
export type PlanPatch = Pick<PlanDocument, "snapshot" | "config" | "commitments" | "favourites" | "rushed">;

/**
 * Drop rushed entries for events that are no longer rushable — anything fully in
 * the past (`end < now`) or no longer in the bundle. You can't rush a finished
 * event, so a lingering rush is dead state; this is the storage twin of the card's
 * `end >= now` eligibility gate. Returns the same document when nothing changed
 * (so the caller skips a redundant write). Run once on load.
 */
function pruneRushedPast(doc: PlanDocument, bundle: EventsBundle, now: CalendarDate, timeZone: string): PlanDocument {
  if (!doc.rushed) return doc;
  // `ev.end` is a baked instant; bucket it to the same calendar-date space as `now`
  // before comparing — a raw instant vs date-only compare is the mismatch class this
  // module's branding now guards against (project_core_utc_and_ingress).
  const stillRushable = new Set(
    bundle.events.filter((ev) => dateStringInTimeZone(ev.end, timeZone) >= now).map((ev) => ev.key),
  );
  const kept: PlanDocument["rushed"] = {};
  let dropped = false;
  for (const [key, instant] of Object.entries(doc.rushed)) {
    if (stillRushable.has(key)) kept[key] = instant;
    else dropped = true;
  }
  if (!dropped) return doc;
  const next = { ...doc };
  if (Object.keys(kept).length > 0) next.rushed = kept;
  else delete next.rushed; // omit, don't store empty
  return next;
}

/** A channel and whether it is currently contributing — what a toggle UI renders. */
export interface ChannelState {
  name: string;
  enabled: boolean;
}

export interface Coordinator {
  /** The current immutable projection (ledger + cached balance series). */
  projection(): Projection;
  /** Convenience: the balance at a cursor date (O(1) into the cached series). */
  balanceAt(date: CalendarDate): ResourceVector;
  /**
   * A committed banner's resources available *before its own spend* — income at the
   * banner's end minus every earlier-resolving banner's spend (project_spend_model's
   * self-exclusion). The card and shield read this for committed banners rather than the
   * flattened series, so a banner never sees its own debit. `undefined` when uncommitted.
   */
  bannerAvailable(bannerKey: string): ResourceVector | undefined;
  /** The current persisted plan (read-only view). */
  document(): PlanDocument;
  /** Every known channel and its enabled state — for a toggle UI. */
  channels(): ChannelState[];
  /** True when the stored plan was unreadable and a clean one was started. */
  recovered(): boolean;
  /** Patch the plan, persist it, and recompute. */
  update(patch: Partial<PlanPatch>): void;
  /** Enable/disable a channel's contribution (ephemeral) and recompute. */
  setEnabled(channel: string, enabled: boolean): void;
  /**
   * Register a listener fired once after each recompute (an `update` or a
   * `setEnabled`); returns an unsubscribe. Reads — `projection`, `balanceAt`,
   * `document`, `channels` — never notify, so the cheap scrub path stays
   * broadcast-free. A bare callback keeps this DOM-agnostic. See
   * docs/frontend/interaction.md (the notify seam).
   */
  subscribe(listener: () => void): () => void;
}

export interface CoordinatorOptions {
  bundle: EventsBundle;
  /** The baked reward tables fed to the play-style income channels via the channel
   *  context. Optional — the app passes the real `bundle.config()`; channel-injecting
   *  tests can omit it. */
  config?: ConfigBundle;
  /** Gacha pull-math constants the spend pass debits committed pity with. Optional —
   *  defaults to the game-true constants; the app passes the baked `config.gacha`. */
  gacha?: SpendGacha;
  /** Today as a calendar date — the projection origin when no snapshot is set yet. */
  now: CalendarDate;
  /** Calendar timezone used to bucket baked event instants into projection dates. */
  timeZone?: string;
  /** Defaults to localStorage (or an in-memory store outside the browser). */
  store?: KeyValueStore;
  /** Defaults to the ground-truth channels; injectable for tests. */
  channels?: ChannelDef[];
}

export function createCoordinator(options: CoordinatorOptions): Coordinator {
  const { bundle, now, config } = options;
  const gacha = options.gacha ?? { caratsPerPull: 150, paidDailyPull: 50, sparkThreshold: 200 };
  const timeZone = options.timeZone ?? UTC_TIME_ZONE;
  const store = options.store ?? defaultStore();
  const registry = options.channels ?? DEFAULT_CHANNELS;

  const loaded = load(store);
  // Sweep dead rush state (events now fully past) on load; persist only if it
  // actually pruned, so a clean plan isn't rewritten on every boot.
  let doc = pruneRushedPast(loaded.doc, bundle, now, timeZone);
  if (doc !== loaded.doc) save(doc, store);
  const enabled = new Map<string, boolean>(registry.map((ch) => [ch.name, true]));
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  // The two-pass fold: the income channels first (independent fixed deltas), then the
  // dependent spends pass resolved against that income balance, then a final flatten of
  // both. `available` carries each committed banner's pre-spend balance (self-excluded).
  function fold(): { projection: Projection; available: Map<string, ResourceVector> } {
    // The snapshot date is a stored string; brand it as the calendar date it is
    // (validated) so it shares the projection's bucket space. Falls back to `now`.
    const after: CalendarDate = doc.snapshot?.date ? cal(doc.snapshot.date) : now;
    const base = doc.snapshot?.resources ?? {};
    // The rushed plan (event keys → bring their discrete payout forward to `start`).
    const rushed = new Set(Object.keys(doc.rushed ?? {}));
    // The account's engagement assumptions, resolved from the persisted config —
    // the single precedence shared with the identity surface (resolvePlayStyle).
    const play = resolvePlayStyle(doc.config).settings;
    // The club rank — an identity selector (not play-style), resolved from the same
    // config.identity block but through its own precedence. Feeds the club-rank channel.
    const clubRank = resolveClubRank(doc.config);
    // Reconstitute the rank-dependent CM rewards the bake omits (issue #19): stamp the
    // player's CM rank payout onto every CM event so the ground-truth `events` channel
    // folds it (on each CM's last day) and the below-lane card renders it — without the
    // events channel learning about config/play. A bundle reshape, like `rushed`.
    const folded = config ? applyChampionsMeetingRewards(bundle, config, play.championsMeeting) : bundle;
    const income = registry
      .filter((ch) => enabled.get(ch.name) !== false)
      .map((ch) => ({ stream: ch.name, emissions: ch.emit({ bundle: folded, after, timeZone, rushed, config, play, clubRank }) }));
    const incomeProjection = project({ resources: base }, income);
    const spends = spendStream(committedBanners(bundle, doc.commitments ?? {}, timeZone), incomeProjection.series.balanceAt, gacha, after);
    const projection = project({ resources: base }, [...income, { stream: "spends", emissions: spends.emissions }]);
    return { projection, available: spends.available };
  }

  let current = fold();

  return {
    projection: () => current.projection,
    balanceAt: (date) => current.projection.series.balanceAt(date),
    bannerAvailable: (bannerKey) => current.available.get(bannerKey),
    document: () => doc,
    channels: () => registry.map((ch) => ({ name: ch.name, enabled: enabled.get(ch.name) !== false })),
    recovered: () => loaded.recovered,
    update(patch) {
      doc = { ...doc, ...patch };
      save(doc, store);
      current = fold();
      notify();
    },
    setEnabled(channel, isEnabled) {
      if (!enabled.has(channel)) return; // unknown channel — nothing to toggle (no recompute, no notify)
      enabled.set(channel, isEnabled);
      current = fold();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
