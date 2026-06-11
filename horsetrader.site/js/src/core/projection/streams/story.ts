/**
 * The story channel: a story event's graded Pt-reward bundle, selected by the
 * player's play-style **story tier**. Story events carry no rewards of their own
 * any more — the ETL folds the Pt-reward ladder, the bingo, and the story-chapter
 * carats into one curated bundle per *era* (`reward_maps["story-<era>"]`), graded
 * by tier (sweetie/casual/focused/dedicated). Each story record names only its
 * `era` (the scraped Pt-ladder ceiling: `1m` / `1-5m`, or `null` for the historical
 * proto era, which pays nothing). The client expands the matching map row at the
 * player's tier. See docs/frontend/glue.md and config/yaml/reward_structures.yaml.
 *
 * This is a play-style income channel like team-trials/club-rank — it *selects* a
 * baked row, never authoring a value — but unlike them it is event-driven, not a
 * synthesised cadence: it walks the timeline's story events and pays each one's
 * bundle on the event's `end`. Stories are rush-eligible, so a rushed story's
 * discrete bundle is pulled forward to its `start`, exactly as the `events`
 * channel does for the rewards it folds (see project_rushed_feature).
 *
 * The selector is the play-style `storyEvents` key (what you play stories *for*),
 * which the client maps onto the reward-map tier label. The map only carries the
 * four engagement tiers, so the two "achievement" archetypes both fold onto the
 * `dedicated` ceiling — the 600k→ceiling stretch is featureless grind, so
 * dedicated == unhinged for story income (the ETL collapses them to one row).
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { StoryEventKey } from "../../playstyle/index.ts";
import type { StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, dateStringInTimeZone } from "../dates.ts";
import { flatPayload } from "./rewardmap.ts";

/** The baked `reward_maps` key prefix; an era (`1m`) appends to it (`story-1m`). */
const STORY_MAP_PREFIX = "story-";

/** Each play-style `storyEvents` archetype → the reward-map tier label it selects.
 *  The map carries only the four engagement tiers, so the two "achievement"
 *  archetypes both fold onto `dedicated` (featureless ceiling grind — see header).
 *  The client owns this mapping; the labels *select* rows, they never carry values. */
const STORY_TIER: Record<StoryEventKey, string> = {
  story: "sweetie",
  welfare: "casual",
  major: "focused",
  achievement: "dedicated",
  earlyAchievement: "dedicated",
};

/**
 * Emit each story event's graded reward bundle, paid on the event's `end` (or its
 * `start` when rushed), keyed by the event. Inert without a config. A story pays
 * nothing — and emits no row — when it has no era (the proto era), when the bake
 * carries no map for its era, or when that map lacks the resolved tier; the same
 * resolve-soft stance as the other graded channels. Only payouts landing strictly
 * after `after` emit (earlier ones are already baked into the snapshot reading).
 */
export function storyStream(
  bundle: EventsBundle,
  config: ConfigBundle,
  storyEvents: StoryEventKey,
  after: CalendarDate,
  timeZone: string = UTC_TIME_ZONE,
  rushed: ReadonlySet<string> = new Set(),
): StreamEmission[] {
  const tier = STORY_TIER[storyEvents];
  const emissions: StreamEmission[] = [];
  for (const event of bundle.events) {
    if (event.type !== "story") continue;
    if (!event.era) continue; // proto era (or no ladder) — not modelled, pays nothing
    const row = config.reward_maps[STORY_MAP_PREFIX + event.era]?.[tier];
    if (row === undefined) continue; // unknown era or tier the bake doesn't carry
    const payload = flatPayload(row);
    if (Object.keys(payload).length === 0) continue;
    // Rushed → the discrete bundle is brought forward from `end` to `start`.
    const date = dateStringInTimeZone(rushed.has(event.key) ? event.start : event.end, timeZone);
    if (date <= after) continue;
    emissions.push({ date, source: event.key, deltas: payload });
  }
  return emissions;
}
