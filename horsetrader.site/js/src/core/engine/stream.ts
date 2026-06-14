/**
 * The engine substrate (Eclipse): streams produce EVENTS, not rewards. Rewards
 * are a property of events; money is a fold over them; cards are a view over
 * them. One currency, two projections — the ledger and the lane. See
 * eclipse/2.DESIGN.md (the model) and eclipse/3.INTERFACE.md (the boundary).
 *
 * A `Stream` is one object with one verb: `id + enabled(ctx) + claims/mints +
 * events(ctx)`. How a stream makes its events is private — *claimers* settle
 * the baked events their claimed types route to them (stamp a play-graded row,
 * pass through, expand compound facets); *synthesisers* mint events the bake
 * doesn't carry (`dailies-<date>`, `visible: false` — on the ledger,
 * off the lane). Streams are mutually anonymous: no stream knows another
 * exists; no ordering between them (the linear fold makes them commute).
 */

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import type { ClubRankTier } from "../identity/clubrank.ts";
import type { PlayStyleSettings } from "../playstyle/index.ts";
import type { CalendarDate } from "../projection/dates.ts";
import type { ResourceVector } from "../projection/ledger.ts";

/** One baked event record, as generated from the ETL's schema. */
export type BakedEvent = EventsBundle["events"][number];

/**
 * One event of the settled world — the render source AND the fold input.
 * A superset of the bake: the baked record rides along untouched (`record`,
 * null for minted events), plus the engine-resolved reward face and the
 * lane-visibility flag. The client renders straight off this; it never joins
 * back to the bundle for a reward amount (eclipse/3.INTERFACE.md).
 */
export interface SettledEvent {
  /** Stable key — and the ledger emission `source` (one naming system). */
  key: string;
  /** The baked `type` for claimed events; the minting stream's name for minted ones. */
  type: string;
  /** Bucketed once, at ingress (`dateStringInTimeZone`). */
  start: CalendarDate;
  end: CalendarDate;
  /**
   * The RESOLVED foldable face — what the card shows and the fold pays.
   * Numeric baked rewards plus any stamped row; excludes `pulls` (banner-scoped,
   * read off `record` at the point of spend, never banked) and the compound
   * shapes (expanded into minted children instead).
   */
  rewards: ResourceVector;
  /** False ⇒ ledger-only (synthesised cadence) — on the ledger, off the lane. */
  visible: boolean;
  /** The baked record (display fields: art, title, contents…); null when minted. */
  record: BakedEvent | null;
}

/**
 * What a stream may read — the frozen account-state + bake context one fold
 * runs over. Built by the coordinator from `(bake, account state)` and frozen
 * for the fold's duration; streams never read anything else.
 */
export interface StreamCtx {
  bundle: EventsBundle;
  /** The baked reward tables (`reward_structures`/`reward_maps`/`gacha`). */
  config: ConfigBundle;
  /** The calendar timezone baked instants are bucketed into at ingress. */
  timeZone: string;
  /**
   * The projection origin (snapshot date). Payment filtering is the FOLD's job
   * (single place, double-count prevention); synthesisers may also pre-filter
   * their minted cadence here purely for volume — same semantics.
   */
  after: CalendarDate;
  /** The account's resolved play-style assumptions (engagement levels). */
  play: PlayStyleSettings;
  /** The resolved club rank — an identity selector; null = not in a club. */
  clubRank: ClubRankTier | null;
  /** Daily Carat Pack validity date (a cycle boundary); null = not subscribed. */
  dailyPack: CalendarDate | null;
  /** Whether the player owns the Training Pass premium track. */
  trainingPass: boolean;
  /**
   * The baked events this stream's `claims` routed to it (empty for pure
   * synthesisers). Routing is constructor machinery — the registry slices the
   * bundle by the declared claims so no stream re-implements the partition and
   * the complement claimer stays as anonymous as everyone else.
   */
  owned: readonly BakedEvent[];
}

/**
 * One stream — the single declaration shape, fully adopted, no exceptions.
 * `claims` are event TYPES (the bake's own disjoint taxonomy — see
 * eclipse/4.REGISTRY.md derivation 1), `"complement"` for the one ground-truth
 * stream owning everything unclaimed. `mints` are reserved minted-key prefixes,
 * fenced against the bake at registry construction.
 */
export interface Stream {
  /** Dotted `selector.name` (`play.dailies`, `ground.events`, `subscription.daily-pack`). */
  readonly id: string;
  /** Baked event types this stream settles, or the complement of all claims. */
  readonly claims: readonly string[] | "complement";
  /** Minted key prefixes this stream synthesises under (`["dailies-"]`). */
  readonly mints: readonly string[];
  /**
   * The on/off gate, owned by the stream. Gating is PRESENCE, not pricing: a
   * disabled claimer's events leave the settled world — off the ledger AND off
   * the lane (eclipse/4.REGISTRY.md). Streams whose cards must stay rendered
   * regardless of play stay always-enabled and vary the *face* instead.
   */
  enabled(ctx: StreamCtx): boolean;
  /** The one verb: this stream's slice of the settled world. */
  events(ctx: StreamCtx): SettledEvent[];
}

/** A stream's settled events tagged with the stream id, for ledger attribution. */
export interface TaggedEvents {
  stream: string;
  events: SettledEvent[];
}

/** Mint one invisible single-day event (the synthesised-cadence shape). */
export function minted(key: string, type: string, date: CalendarDate, rewards: ResourceVector): SettledEvent {
  return { key, type, start: date, end: date, rewards, visible: false, record: null };
}
