/**
 * Entity query broker — the seam over the bundle for entity lookups. UI
 * components ask here for ranked search, oshi options, and (later) the events
 * featuring a card, instead of joining baked records and re-deriving labels and
 * match logic themselves. See docs/frontend/catalog.md.
 */

export type { SearchIndex, SearchKind, SearchResult } from "./entities.ts";
export { createSearchIndex } from "./entities.ts";

export type { OshiOption, OshiSearchIndex } from "./oshi.ts";
export {
  CURATED_OSHIS,
  DEFAULT_OSHI_ID,
  createOshiIndex,
  oshiChoices,
  searchOshis,
  selectedOshiOption,
  starterOshis,
} from "./oshi.ts";
