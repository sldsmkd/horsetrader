/**
 * The channel registry: how the bundle becomes projection streams. Each channel
 * is a named, independent `(date, deltas)` producer; the coordinator folds the
 * enabled ones via `project()`. Adding a reward source is adding a channel here —
 * never editing the fold. Toggling one off is the coordinator dropping it from
 * this list for a recompute; the channel keeps existing, it just stops
 * contributing. See docs/frontend/projection.md.
 */

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import type { ClubRankTier } from "../identity/clubrank.ts";
import type { PlayStyleSettings } from "../playstyle/index.ts";
import type { CalendarDate, StreamEmission } from "../projection/index.ts";
import {
  clubRankSpecFromBundle,
  clubRankStream,
  eventStream,
  generatorStream,
  generatorsFromBundle,
  isMissionEvent,
  missionStream,
  dailyPackSpecFromBundle,
  dailyPackStream,
  routineSpecFromBundle,
  routineStream,
  sequenceStream,
  sequencesFromBundle,
  shopTicketsSpecFromBundle,
  shopTicketsStream,
  teamTrialsSpecFromBundle,
  teamTrialsStream,
  trainingPassStream,
} from "../projection/index.ts";

export interface ChannelContext {
  bundle: EventsBundle;
  /** The projection origin date; channels emit only strictly after it. */
  after: CalendarDate;
  /** The calendar timezone the day-bucketed projection is viewed in. */
  timeZone: string;
  /** Event keys the player has rushed — their discrete payout attributes at
   *  `start`, not `end`. The events channel is the only one that honours it
   *  (compound rewards don't move); other channels ignore it. */
  rushed: ReadonlySet<string>;
  /** The baked reward tables (`reward_structures`/`reward_maps`/`gacha`). The
   *  ground-truth channels ignore it; the play-style income channels select their
   *  rows/structs from here. Optional so channel-injecting tests need not bake one;
   *  in the app it is always the real `bundle.config()`. See docs/frontend/glue.md. */
  config?: ConfigBundle | undefined;
  /** The account's resolved play-style assumptions (engagement levels). The
   *  income channels pick a reward row/scale from these; ground-truth channels
   *  ignore it. Always present (resolves to the default preset when unset). */
  play: PlayStyleSettings;
  /** The account's resolved club rank — an **identity** selector (not play-style),
   *  the `reward_maps.club-rank` label the club-rank channel pays monthly. `null`
   *  when the trainer isn't in a club, so the channel pays nothing. See
   *  core/identity/clubrank. */
  clubRank: ClubRankTier | null;
  /** The Daily Carat Pack subscription's validity date (a cycle boundary), or `null`
   *  when not subscribed — the signal the daily-pack channel reads to pay nothing.
   *  Resolved from `config.dailyPack` by `resolveDailyPack`. */
  dailyPack: CalendarDate | null;
  /** Whether the player owns the **Training Pass premium track** — the paid boost the
   *  training-pass channel folds on top of each Training Pass event's baked free track.
   *  A single binary toggle (no per-event input), resolved from `config.trainingPass`
   *  by `resolveTrainingPass`; `false` ⇒ the channel pays nothing. */
  trainingPass: boolean;
}

export interface ChannelDef {
  name: string;
  emit(ctx: ChannelContext): StreamEmission[];
}

/** The ground-truth channels, in fold order — immutable bundle data. The only
 *  user input they read is `rushed` (the events channel pulls a rushed event's
 *  discrete payout forward to its start); amounts are never user-authored here. */
export const GROUND_TRUTH_CHANNELS: ChannelDef[] = [
  // The events channel folds every below/above-lane event EXCEPT normal missions —
  // those are split onto the play-gated `missions` income channel (see below), so
  // this stays the universal, config/play-agnostic fold.
  { name: "events", emit: ({ bundle, after, timeZone, rushed }) => eventStream(bundle, after, timeZone, rushed, (ev) => !isMissionEvent(ev)) },
  { name: "generator", emit: ({ bundle, after, timeZone }) => generatorStream(generatorsFromBundle(bundle, timeZone), after) },
  { name: "sequence", emit: ({ bundle, after, timeZone }) => sequenceStream(sequencesFromBundle(bundle, timeZone), after) },
];

/** The play-style income channels — they read `config` (baked reward tables) and
 *  `play` (the account's engagement levels) to synthesise recurring income the
 *  bundle does not enumerate. Inert without a config (channel-injecting tests omit
 *  it); the app always supplies the real `bundle.config()`. See docs/frontend/glue.md. */
export const INCOME_CHANNELS: ChannelDef[] = [
  {
    // The regular mission campaigns — a gating flag, not a scaled channel: the
    // baked mission rewards are folded as their own stream when the player does
    // missions (`play.missions === "yes"`) and dropped wholesale when they don't.
    // No `config` needed — it reads the events' own baked rewards, not a table.
    // (Anniversary missions are a separate type and stay universal, never gated.)
    name: "missions",
    emit: ({ bundle, after, timeZone, rushed, play }) =>
      play.missions === "yes" ? missionStream(bundle, after, timeZone, rushed) : [],
  },
  {
    name: "routine",
    emit: ({ bundle, config, play, after, timeZone }) => {
      if (!config) return [];
      const spec = routineSpecFromBundle(bundle, config, play.weeklyPlay, timeZone);
      return spec ? routineStream(spec, after) : [];
    },
  },
  {
    name: "team-trials",
    emit: ({ bundle, config, play, after, timeZone }) => {
      if (!config) return [];
      const spec = teamTrialsSpecFromBundle(bundle, config, play.teamTrials, timeZone);
      return spec ? teamTrialsStream(spec, after) : [];
    },
  },
  {
    name: "club-rank",
    emit: ({ bundle, config, clubRank, after, timeZone }) => {
      if (!config || clubRank === null) return [];
      const spec = clubRankSpecFromBundle(bundle, config, clubRank, timeZone);
      return spec ? clubRankStream(spec, after) : [];
    },
  },
  {
    // Shop tickets needs no baked table (the bracket count *is* the payload), but it
    // still gates on `config` so the income channels stay uniformly inert in the
    // config-less tests that exercise only the ground-truth fold.
    name: "shop-tickets",
    emit: ({ bundle, config, play, after, timeZone }) => {
      if (!config) return [];
      const spec = shopTicketsSpecFromBundle(bundle, play.shopTickets, timeZone);
      return spec ? shopTicketsStream(spec, after) : [];
    },
  },
  {
    // The Daily Carat Pack subscription. Reads the baked `reward_structures.daily-carats`
    // (50/day generator + 500 paid) for its amounts and the resolved validity date
    // (`dailyPack`) for its phase — inert without either, like its siblings.
    name: "daily-pack",
    emit: ({ bundle, config, dailyPack, after, timeZone }) => {
      if (!config) return [];
      const spec = dailyPackSpecFromBundle(bundle, config, dailyPack, timeZone);
      return spec ? dailyPackStream(spec, after) : [];
    },
  },
  {
    // The Training Pass premium track — a paid-money toggle in the same dolphin family.
    // Reads the binary `reward_maps["training-pass"]["premium"]` boost and the resolved
    // toggle (`trainingPass`), folding the boost onto each Training Pass event's end on
    // top of its baked free track. Inert without a config or while the toggle is off.
    name: "training-pass",
    emit: ({ bundle, config, trainingPass, after, timeZone }) => {
      if (!config) return [];
      return trainingPassStream(bundle, config, trainingPass, after, timeZone);
    },
  },
];

/** Every channel the coordinator folds by default — ground truth plus play-style income. */
export const DEFAULT_CHANNELS: ChannelDef[] = [...GROUND_TRUTH_CHANNELS, ...INCOME_CHANNELS];
