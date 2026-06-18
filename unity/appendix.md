# Unity — appendix (research findings)

Reference only. These findings **proved the assumptions** the design rests on (the
$0 keystone and the user-base sizing); they're kept for provenance, not for
re-reading. See [design.md](design.md) §10 (cost) and [unity.md](unity.md) (scope)
for the decisions they back. All data 2026-06-18.

---

## A — pricing (cost model)

R2 + Worker cost model. **Pricing snapshot 2026-06-18 — re-verify before relying.**

R2 free: **10 GB**, **1M Class A** (writes), **10M Class B** (reads), egress free.
Overage: Class A **$4.50/M**, Class B **$0.36/M**, storage **$0.015/GB-mo**.
Map: **push = PUT = Class A**, **pull = GET = Class B**; conditional PUT folds the
conflict check into the same op (no extra HEAD). So 1 push = 1 Class A, 1 pull = 1
Class B.

**Blob size — measured:** a genuinely engaged save (25 commitments, 35 favourites, no
notes) = **2,426 B raw / 1,022 gzipped**. Ballooned (~150 favs, some noted) ≈ ~10–20
KB. The persistence.md pathological ceiling (~950 noted favs) ≈ 1 MB, unreachable.

Per-active-user-per-month profiles (S=sessions, P=pushes/session, G=pulls/session):

| Profile | S | P | G | A ops/mo | B ops/mo | blob |
| --- | --- | --- | --- | --- | --- | --- |
| Casual | 8 | 4 | 1 | 32 | 8 | ~2.5 KB |
| Regular | 20 | 8 | 2 | 160 | 40 | ~8 KB |
| Power | 40 | 20 | 3 | 800 | 120 | ~20 KB |

**Free-tier headroom** (binding limit bold):

| Profile | by Class A (1M/mo) | by Class B (10M/mo) | by storage (10 GB) |
| --- | --- | --- | --- |
| Casual | **31,000** | 1,250,000 | 200,000 |
| Regular | **6,250** | 250,000 | 66,000 |
| Power | **1,250** | 83,000 | 25,000 |

**Workers 100k requests/DAY is the *first* ceiling actually hit** (every sync op = 1
request). At a frugal ~2–4 req/active-user/day → **~25k–50k daily-active users free.**

**Paid overage (the cliff to AVOID, not a budget)** — Regular profile:

| Users | Class A | Class B | Storage (~8 KB) | R2 | + Worker | ~Total/mo |
| --- | --- | --- | --- | --- | --- | --- |
| 10 K | 1.6M → $2.70 | free | free | $2.70 | ~$5 | ~$8 |
| 100 K | 16M → $67.50 | free | free | $67.50 | ~$8 | ~$76 |
| 1 M | 160M → $715 | 40M → $10.80 | 8 GB → free | $726 | ~$62 | ~$788 |

**Takeaways:** (1) the bill is *entirely* Class A = pushes — storage never binds
(real ~8 KB blobs; even 1M users = 8 GB, under free). (2) Frugality is the lever:
minimise pushes (user-initiated + push-on-close). The overage numbers show headroom,
but the principle (design.md §10) is **engineer to stay $0**, not "cheap if we spill."

---

## B — user-base sizing

Triangulating the *addressable* base. **Three independent signals converge on ~100K
active.**

**Signal 1 — in-game Team Trials class bands** (retention line ≈ class headcount):

| Class | Signal |
| --- | --- |
| **C6** (top tier) | retention ~23,090th → **~23k** in top band |
| **C5** (semi-serious) | player at 69,812th still "in retention range" (promotion line ~32,186th) → C5 floor past ~70k; **C5+C6 ≈ ~100k** |

**Signal 2 — SteamCharts** (PC build only): last-30-day ~6,620 avg / ~11,144 peak
concurrent; launch (Jul 2025) ~35,846 avg / ~87,453 peak — classic gacha decay, fresh
uptick imminent (~1-yr anniversary). PC-only undercounts the mobile-dominant total
BUT **planner-users are over-represented on Steam** (only PC venue, skews serious) →
a decent proxy for the planner TAM specifically. Rough heuristics → ~tens of
thousands Steam monthly actives.

**Signal 3 — uma.moe global rankings** (best signal; monthly fan-gain = engagement by
rank): ~20k-th ≈ 21 M/mo, ~50k ≈ 13 M, ~100k ≈ 7 M, ~200k ≈ 1.8 M. User self-anchor:
~3 M/mo ≈ casual; "me casual" ≈ 7 M (rank ~100k); "me engaged" ≈ 18 M (rank ~25–30k).
Casual floor by ~rank 100k.

**Takeaway:** addressable TAM **≈ ~100K active** (≈150K to the casual tail).
horsetrader's audience = planning-inclined ⊂ active → realistic registered cloud-sync
capture is a **fraction** of ~100k. Cross-check vs design.md §10: frugal cadence holds
~25–50k DAU free → **realistic scale stays $0**; only the implausible
all-100k-eager-push ceiling would breach free, and the answer there is frugal cadence,
never paid. *Caveats:* class banding may be regional; fan-gain conflates whaling with
playtime; the active threshold is a judgement call. Order-of-magnitude, but
triangulated.
