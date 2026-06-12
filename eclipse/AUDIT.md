# Eclipse — Stream Audit

_Census of every reward producer as it exists today (pre-Eclipse). Source: `core/projection/streams/` + `core/coordinator/`._

## The producers (13)

| # | producer | declared in | producer shape | selector | reads bake table |
|---|----------|-------------|----------------|----------|------------------|
| 1 | events | `GROUND_TRUTH` | direct bundle fold (`+where` predicate) | none | no (event's own `rewards`) |
| 2 | generator | `GROUND_TRUTH` | extractor→expander, **plural** specs | none | no (inline `rewards.generator`) |
| 3 | sequence | `GROUND_TRUTH` | extractor→expander, **plural** specs | none | no (inline `rewards.sequence`) |
| 4 | missions | `INCOME` | thin wrapper over `eventStream` | play (gate) | no (event's own `rewards`) |
| 5 | routine | `INCOME` | `*FromBundle`→`*Stream`, **single** spec | play | yes (`reward_structures`) |
| 6 | team-trials | `INCOME` | `*FromBundle`→`*Stream`, single spec | play | yes (`reward_maps`) |
| 7 | club-rank | `INCOME` | `*FromBundle`→`*Stream`, single spec | **identity** | yes (`reward_maps`) |
| 8 | shop-tickets | `INCOME` | `*FromBundle`→`*Stream`, single spec | play | **no** (bracket = payload) |
| 9 | daily-pack | `INCOME` | `*FromBundle`→`*Stream` + own `resolve*` | subscription date | yes (`reward_structures`) |
| 10 | training-pass | `INCOME` | direct bundle fold + own `resolve*` | play (binary) | yes (`reward_maps`) |
| 11 | story | `INCOME` | direct bundle fold | play | yes (`reward_maps`) |
| 12 | champions-meeting | **nowhere** — hardwired pre-fold bundle reshape | not a producer (`apply*Rewards`) | play | yes (`reward_maps`) |
| 13 | spends | **nowhere** — hardwired post-fold dependent pass | dependent producer (reads income balance) | commitments | no (gacha consts) |

## Axes of inconsistency
- **Declaration**: 11 live in the `ChannelDef` registry; 2 (champions-meeting, spends) are hand-wired into `coordinator.fold()` — the "convenient hole" cases that violate "never edit the fold".
- **Producer shape**: 4 fold the bundle directly; 5 are `spec+FromBundle→Stream`; 2 are plural-spec extractors; 1 is a pre-fold reshape; 1 is a dependent pass. At least 4 distinct silhouettes.
- **Control surface**: scattered. The enable/disable gate + which-config-it-reads live in the `channels.ts` emit closures (`play.missions==="yes"?…:[]`, `if(!config)return[]`), NOT in the stream. The *scale interpretation* (`DAYS_PER_WEEK`, `TEAM_TRIALS_CADENCE`, `STORY_TIER`, …) IS stream-owned — that half is already right.
- **Namespacing**: channel `name` and emission `source` are ad-hoc literals (per-module consts or inline). Mostly name==source, but routine emits `dailies`/`weekly-login`, daily-pack's source is `daily-carats` not `daily-pack`. No central namespace.
- **`flatPayload` x3**: exported from `rewardmap.ts`, yet `routine.ts` and `championsmeeting.ts` each redefine a private copy.

## Holdouts (the work)
- **champions-meeting** & **spends** are the two that don't fit the registry — opposite ends (pre-fold reshape vs post-fold dependent). The registry shape has to grow to hold both, or they stay justified exceptions.
- **spec vs direct-fold** split is real but maybe fine — it tracks "synthesised cadence" vs "event-driven". Decide if that's a sanctioned dimension or an accident.
