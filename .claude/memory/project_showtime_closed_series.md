---
name: project_showtime_closed_series
description: "Fuji Kiseki Showtime is a closed 2-event series — curate, don't predict"
metadata: 
  node_type: memory
  type: project
  originSessionId: 369e281a-6e60-4bc3-bb00-656df75fed44
---

"Showtime Event" (フジキセキのショータイム) is a **closed set of exactly two
events**, Fuji-Kiseki-only — there were only ever two in JP and there will
never be more:

- フジキセキのショータイム(2021): JP 2021/11/15 12:00 – 11/26 11:59
- フジキセキのショータイム(2022): JP 2022/06/20 12:00 – 06/30 11:59 → **EN
  shipped this final one Jun 4–14 2026 (UTC)**

**Why:** neither our ETL nor uma.moe forecast it for June 2026 because it's not
a cadence. It is a finite curated pair, not a recurring event class.

**Data shape:** for special events all we care about is **when it ran (window),
the name, and the payload** (the rewards/items it gave out — see
docs/domain.md (Rewards)). No featured-character/banner structure — just
those three.

**Prediction:** special events **as a class still need prediction** — they're a
predicted event type like any other. Fuji Kiseki Showtime is the *exception*:
it'll **never get predicted** because the series is already complete (2 events,
last shipped EN June 2026), so for this one it's pure historical curation.

**Sourcing:** see [[reference_data_sources]] for the source map (official EN site
= truth/overlay names; Gametora = database/live primary; GameWith = structured
rewards, esp. anniversaries; wikiru = community event index). Build JP-first per
[[feedback_jp_is_substrate]].

**Intended approach (user's lean, 2026-06-01):** for the special-event long tail,
do a **one-off semi-custom extract** (GameWith for structured reward data;
wikiru for the window+name index) → emit a **human-maintained YAML**, then take
human ownership of the result. The scrape is a **bootstrap to seed the curated
file**, *not* a live ingester like Gametora — afterwards it's hand-maintained
static data (same discipline as [[feedback_curated_yaml_fails_loud]] /
[[project_static_yaml_region_namespace]]). Keeps a brittle JP-wiki dependency out
of the hot path for a small, slow-moving long tail. Open call for build time:
park the extract script (e.g. `references/import/`) so it's re-runnable, vs. a
true throwaway.

**How to apply:** per the user (2026-06-01) Showtime goes in the **special-event
bucket alongside a few other infrequent one-offs**, not its own type. It doesn't fit docs/domain.md (Story Events) (`stories.yaml` is an EN overlay
on the Gametora story scrape; Showtime isn't an ordinal `story-NNN`). As of
2026-06-01 it is **still un-curated** and explicitly **deferred** (user: "haven't
done the kisekis yet… don't do it right now") — TODO. Build JP-first per
[[feedback_jp_is_substrate]].
