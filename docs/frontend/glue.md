# The final glue: wiring customisation into the live projection

Status: **in progress** (2026-06-09). `core/` (persistence + projection +
coordinator) is built and tested; the view layer is landing surface by surface.
This doc names the work that connects the two — the recurring shape every
interactive surface follows, and the epic of wiring user-customisation flows back
into the fold. It is the "last 20%" that makes the planner *react*.

## The shape: surfaces are live views over one coordinator

Every read surface derives from the same seam — `coordinator` — and follows it
through **two** update channels, deliberately kept apart:

1. **Data changes** (a new snapshot, a flipped commitment, a toggled channel):
   the coordinator refolds and `notify()`s. Subscribers (`coord.subscribe`)
   re-run and rebuild. Rare, discrete, a full rebuild is fine.
2. **View-date changes** (panning the timeline at 60 Hz): the *cheap path*. The
   timeline hands the centre date to `onView`, which reads the already-cached
   balance series and pushes it into the open surfaces **imperatively** — never a
   refold, never a full overlay rebuild. See [interaction.md](interaction.md) and
   the 4f minimap design.

The Resources card is the reference implementation of (2): `resourcesSurface`
returns a handle `{ el, update }`, app.ts holds it in `liveResources` while the
card is mounted, and `onView` calls `liveResources.update({ viewDate, projected })`
on the same cheap path that already feeds the menubar. The view-date-derived part
of the card (carats, tickets, limit-breaker meters) swaps in place; the footer,
which reports on the saved snapshot rather than the view date, is built once.

**The rule for any new live surface:** if it shows a projected value, give it an
`update()` handle and feed it from `onView`; do not put it on the refold path for
something a pan changes. If it shows a *stored input*, rebuild it on
`coord.subscribe`. Most surfaces have both kinds of content — split them.

## Customisation flows are writes into the coordinator (the epic)

The UI's customisation surfaces — the **Play Style** sliders (engagement levels:
weekly play, team-trials rank, legend races, missions…), the **Resources**
editor, account **config**, per-banner **commitments** — are all *writers*. The
glue is uniform and small per surface, but there are many seams:

```
widget onChange  →  coord.update({ config | snapshot | commitments | … })
                 →  coordinator refolds the enabled channels
                 →  notify()  →  every live surface re-derives
```

Today only Resources (`snapshot`) and favourites/rushed are wired this way. The
remaining work, roughly one epic:

- **Engagement levels → config → recurring income.** Play-style sliders change how
  much the recurring channels pay (daily play frequency, PvP rank income, legend
  race cadence). The **rate tables already exist, baked** in `static/json/config.json`
  (`reward_structures`: `dailies`/`daily-carats`/`weekly-login` generators+sequences;
  `reward_maps`: `team-trials` by rank, `club-rank`, `champions-meeting`,
  `league-of-heroes`, `masters`, `strongest-team` — plus `gacha` constants like
  `carats_per_pull`, `spark_threshold`). The PvP tier maps are deliberately *not*
  stamped onto events (PvP events carry no rewards by design — issue #19) precisely
  because the row depends on the user's rank/engagement. **The data channel is now
  built (2026-06-09):** `config.schema.json` generates `config.gen.ts` (root
  `ConfigBundle` + `GachaConfig`) via `gen:types`; `config.json` is fetched in
  `main.ts` alongside events/academy and exposed as `bundle.config()` (resolve-or-throw,
  a required peer of events/academy). First consumer: the above-lane banner readout
  reads `gacha.carats_per_pull` for the pulls count. **What's still unbuilt is the
  *channels*:** (a) ~~load config~~ done; (b) wire each engagement slider's commit to
  `config`; (c) a channel that reads the user's level, picks the reward-map row, and
  emits it as recurring income (and, for the commit shield, feeds `spark_threshold` /
  `rarity_rates` / `featured_rates` into affordability + the LB distribution). The
  only *narrower* ETL-side question left is #19's account-pager / "sweatiness" model —
  how a single rank choice grades over a season — not the raw rates, which are here.
- **Commitments → spends channel (the debit side).** Spending plans are the mirror
  of engagement income: a planned pull on a banner is a **negative** carat delta
  landing on that banner's date — a debit on the timeline. This is the one stream
  that consumes the fold's own output (affordability: pity → pulls → carats). The
  same audit below applies: a commitment goes in the fold only when it resolves to a
  concrete, *dated* debit. **The write/persist half is now built (2026-06-09):** the
  **commit shield** (`views/commitShield.ts`, spawned at source from the banner
  readout — `state.committing`, the same modal-shield grammar as the balance editor)
  lays one banner's pull sources back out (the `select/commit.ts` view-model: Carat
  Est. / Paid Carat Est. / Max Pulls + the Henry Free·Tickets·Paid split), takes the
  commitment as a **pity** stepper (principle 10, cost derived), and writes it to
  `commitments[bannerKey]` via `coord.update`. Affordability is computed *in the
  shield* against the income fold's `pullsAvailable` (pity × `spark_threshold` vs Max
  Pulls — a red "short by N pulls" verdict) — note this does **not** need the spends
  channel, since it reads the *income* balance at the banner date. **Still parked:**
  (a) the spends *channel* itself — folding the committed pity as a dated carat debit
  so downstream banners' `pullsAvailable` drops live; (b) the expected-copies
  distribution (None/0LB…MLB), in as a **layout placeholder** until the probability
  model (binomial over pulls + spark guarantees) lands. See [projection.md](projection.md).
- **Update callbacks for live re-render.** Every customisation surface that can be
  open while another surface reads must trigger the refold path on commit, and the
  open readers must follow. The handle/`update()` pattern above is how; the work
  is wiring each surface's commit to `coord.update` and making sure open surfaces
  are subscribed.

Keep the discipline from [persistence.md](persistence.md): config holds the user's
*gating choices only*, never game-data values. A slider stores "I play 6 days a
week," not a carat number; the carat number is derived by a channel that scales a
baked rate.

### The per-item audit (both sides of the ledger)

This triage is not just for sliders. **Every** customisation input — engagement
income (**credits**) *and* spending plans/commitments (**debits**) — gets the same
one-at-a-time audit: *does this resolve to a concrete, dated ledger delta?* A
planned pull is a dated negative delta and goes in; a "Missions 70%" resolves to
nothing and does not. One test, both signs.

The wiring pass walks the Play Style sliders **one by one** and sorts each into one
of three buckets — do not assume every slider becomes a channel:

1. **Projectable input** — resolves to a baked table row or rate, so it drives a
   channel. Team Trials *rank* → `reward_maps.team-trials`; weekly play frequency →
   scales the daily/login generators. These are the real engagement inputs.
2. **Unprojectable — cut or demote.** Some sliders cannot be turned into income
   even in principle. The "**Missions 70%**" is the canonical example: a percentage
   says nothing about *which* missions were done versus skipped, and each mission
   pays differently, so there is no resolvable reward behind it. We will not invent
   a fake expected value. Such a slider either goes, or survives as pure
   **identity/flavour** (it colours the trainer's story, see
   [identity-presets.md](identity-presets.md)) with **no effect on the fold**.
3. **Gating flag** — a boolean-ish choice that turns a whole channel on/off (e.g.
   "I buy the Daily Carats pack") rather than scaling one. Patches `config`, the
   channel reads it.

The rule: a slider earns a channel only when it maps to a concrete, baked reward
selection. If it doesn't, that's a signal to cut it or keep it identity-only — not
to manufacture a number. Decide per slider during the pass; record the verdict.

## Wall-clock snapshots, and the reset-aware boundary still owed

The resource `Snapshot` carries `recordedAt` — the full UTC instant the reading
was taken (`new Date().toISOString()`), alongside `date` (its UTC day). This is
captured but **not yet fully used**.

Why it matters: the generator channel drops same-day payouts as "already in your
balance" via `date <= after` (`streams/generator.ts`). That is purely
daily-granular. But the game resets and drops content at *specific times* — record
your balance at 02:00 UTC before the daily reset and today's login reward has not
landed yet; record after and it has. The daily boundary can't tell these apart.

**Owed (piece 2):** make that boundary reset-aware — compare each payout's reset
*instant* against `recordedAt`, not `date` against `date`. This needs a
**reset-hour model** (JP daily reset time, content-drop times), which is
game-cadence data, so it is gated on an ETL/contract decision, not just a client
change. Until then the fold stays daily-granular and the surface footer stays
day-granular ("updated N days ago"); `recordedAt` is stored and ready.
