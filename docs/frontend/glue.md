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
  reads `gacha.carats_per_pull` for the pulls count. **The first income channel is now
  built (2026-06-10): `routine`** (`streams/routine.ts`, in the new `INCOME_CHANNELS`
  list beside the ground-truth ones). It reads `reward_structures.dailies` (flat per
  login) + `reward_structures.weekly-login` (the 7-entry cycle) and the account's
  `play.weeklyPlay` level, and synthesises login-day income from the **server epoch**
  (the earliest bundle date) to the timeline's right edge (the latest bundle date).
  The settled model: login days are spread evenly across each 7-day block
  (`daysPerWeek` of every 7 — "prorate the logins"); the daily payload lands on every
  login; the login bonus **advances one slot per login and resets every 7 logins** —
  NOT use-or-lose by weekday — so its slot is indexed by login *count* from the epoch,
  a `null` entry just being a login with no bonus carat. The cycle phase advances
  across the snapshot (logins ≤ `after` still count) so it's snapshot-independent.
  Note `reward_structures.daily-carats` (the paid 30-day pack) is deliberately *not*
  this channel — it's a purchase, not login-gated income.
  **The first *graded* income channel is now built (2026-06-10): `team-trials`**
  (`streams/teamtrials.ts`, in `INCOME_CHANNELS`). It reads `reward_maps.team-trials`
  and the account's `play.teamTrials` level, and synthesises the weekly Team Trials
  carats, **granted on the calendar Monday at server reset** (epoch→horizon, the
  realised moment for the week that just closed — not epoch+7k). The settled model
  reshaped the ETL data — and that reshape is the **accepted state, no ETL pass owed**
  (a full `make` re-baked clean, `config.json` in sync, 2026-06-10): the
  Team Trials carats depend on the *transition into* a class that week, not the class
  alone, so the reward map is now keyed `<class>:<state>` (`6:promotion` 300,
  `6:retention` 375, `5:demotion` 225, …) off the in-client Class Rewards table — only
  Class 6 actually differs by state; Class ≤5 pays the same in every transition. The
  client owns the **per-Monday state cadence**: a stable class collects its
  `:retention` (length-1 cycle); a **"flapping"** mid account that cycles promote-to-6 /
  demote-to-5 alternates `6:promotion` (300) and `5:demotion` (225) — a real two-week
  cadence the old synthetic `5.5: 262` row had pre-collapsed to their mean. The flap
  phase anchors at the epoch and advances across the snapshot, so it's
  snapshot-independent. (The Friend-Point reward component is not carats/pulls, so it's
  dropped.) `play.teamTrials` is **class only** — `weeklyPlay` does not gate it.
  **The second graded play-style reward is now built (2026-06-10):
  `champions-meeting` — but as an *event enrichment*, not a channel**
  (`streams/championsmeeting.ts`). The decisive difference from `team-trials`: a CM
  *is a real event* on the timeline (`type: "cm"`, 45 of them, a below-lane card each),
  the bake just stamps no rewards on it (PvP carries none by design, #19, *because* the
  payout depends on the rank reached). So the right move isn't a parallel income channel
  attributed to its own source — that would fold the carats but the below-lane card would
  never show them, since the card reads its reward from the **`events`-stream ledger entry
  keyed by the event's own key** (`select/belowLane.ts`). Instead `applyChampionsMeetingRewards`
  **stamps the rank's reward onto every CM record before the fold** (merging: insert + replace
  on key conflict, non-mutating). Then the existing ground-truth `events` channel folds it —
  attributed to the CM key, paid on `end` (the last day) **for free** — *and* the card renders
  the icon. The coordinator's `fold()` does the reshape (config + `play.championsMeeting`), the
  same grammar as `rushed` reshaping event timing, so the `events` channel itself stays
  config/play-agnostic. The level→label map (`CHAMPIONS_MEETING_LABELS`) is an explicit
  **frontend interpretation** — the slider exposes fewer outcomes (skip / Group B
  contender·winner / Group A runner-up·champion) than the table enumerates (Open League +
  the spare 2nd-place rows go unused; Group A "Third" ≈ Group B 1st and nobody runs Open
  League only); `skip` stamps nothing (bundle passes through). The mapping is the only soft
  spot, flagged for the user's correction, not the mechanism. **Lesson for the rest:** a
  graded reward attaches to its event when one exists (enrich), and synthesises a channel
  only when there's no event to hang it on (team-trials/routine).
  **The first *identity*-sourced income channel is now built (2026-06-10): `club-rank`**
  (`streams/clubrank.ts`, in `INCOME_CHANNELS`). Structurally it is the team-trials twin —
  synthesise a channel (no event to hang it on), read `reward_maps.club-rank` and one
  resolved selector, walk a procedural cadence epoch→horizon. Two differences: the cadence
  is **monthly, paid on the 1st** at server reset (the realised reset for the month that just
  closed, the monthly analogue of team-trials' Monday); and the payout is **flat per rank, no
  transition state** — Club Rank pays the same whether you climbed in or held, so a single
  `ResourceVector` repeats every month (no flap cycle). The decisive lesson: **the selector is
  *identity*, not play-style.** Club is identity (a trainer's affiliation, see menu.md), so
  the rank is *not* a `PlayStyleSettings` slider — it rides in the same `config.identity` block
  but is read through its own precedence, `resolveClubRank` (`core/identity/clubrank.ts`), the
  parallel of `resolvePlayStyle`. The coordinator resolves it and threads it into the channel
  context as `clubRank`. For now `resolveClubRank` **defaults to the trainer sheet's hard-coded
  placeholder (`B+`)** — the income flows at B+ until the identity surface grows a real club-rank
  picker (deferred, post-art; the channel is picker-ready, it just reads `config.identity.clubRank`).
  The graded-row payload selector `flatPayload` was lifted to a shared `streams/rewardmap.ts`
  (team-trials + club-rank, N=2).
  **A second monthly channel is now built (2026-06-10): `shop-tickets`** (`streams/shoptickets.ts`,
  in `INCOME_CHANNELS`) — the scout tickets bought from the shop each month, credited on the 1st
  when the stores refresh (same `monthlyStream` cadence as club-rank). It is a **play-style slider**
  (`shopTickets`), and the instructive contrast with the carat channels: its number is **pure
  engagement, no baked table**. The bracket *is* the ticket count — `none` 0 / `cleats` 4 /
  `friendPoints` 6 / `rainbow` 7 of *each* scout-ticket type (`trainee_tickets` + `support_tickets`)
  per month — exactly as routine's `DAYS_PER_WEEK` maps an engagement level straight to a number.
  No `reward_maps` row: the count is a gating choice, not a game-data literal, so the channel needs
  no `config` (it gates on config presence only to stay inert in the config-less fold tests). Two
  cadence primitives were lifted out for these monthly twins: `streams/span.ts` (`bundleSpan` — the
  epoch/horizon scan, now shared by routine/team-trials/club-rank/shop-tickets, N=4) and
  `streams/monthly.ts` (`monthlyStream` — the 1st-of-month walk, club-rank + shop-tickets, N=2).
  **What's still unbuilt is the rest of the income:** (a) ~~load config~~ done; (b) wire each
  engagement slider's commit to `config`; (c) the remaining *graded* sources by rank
  (`league-of-heroes`, `masters`, `strongest-team`) — the PvP ones are events → enrich like
  `champions-meeting`. (`club-rank` was the no-event/synthesise case — now built, #59.)
  Plus, for the commit shield, feed `spark_threshold` / `rarity_rates` / `featured_rates`
  into affordability + the LB distribution. The only *narrower* ETL-side question left is
  #19's account-pager / "sweatiness" model — how a single rank choice grades over a season —
  not the raw rates, which are here.
- **Commitments → spends channel (the debit side).** Spending plans are the mirror
  of engagement income: a committed banner is a **claim** (an accounting earmark),
  emitted as a **negative** carat delta landing on that banner's **start** date — a
  debit on the timeline the moment the banner opens. This is the one stream that
  consumes the fold's own output (affordability: pity → pulls → carats). The
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
  channel, since it reads the *income* balance at the banner date. **Both formerly-parked
  pieces are now built:** (a) the spends *channel* (`streams/spends.ts`, built 2026-06-09)
  folds each committed pity as a dated carat debit so downstream banners' `pullsAvailable`
  drops live — and as of 2026-06-10 the debit lands at the banner's **start** (the claim
  model: measured at `end`, debited at `start`); (b) the expected-copies distribution
  (None/0LB…MLB) shipped as the **Forecast** (`select/forecast.ts` + `widgets/forecast.ts`,
  spark-floored binomial over pulls). See [projection.md](projection.md).
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
