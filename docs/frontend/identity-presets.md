# Identity presets

Status: **draft design**. This note captures the Identity page Play Style presets:
what they mean to players, which game activity streams they imply, and how the
locked companion surface should explain those assumptions.

Identity presets live on the Trainer Card because they answer "who is this
stable?" before they answer "what exact reward tuple should the planner use?"
They are self-location first and planner configuration second.

## Surface

The Identity page currently presents Play Style as:

| Key | Label | Current caption | State |
| --- | --- | --- | --- |
| `sweetie` | Sweetie | Love. Ponies. Sunshine. | selectable |
| `casual` | Casual | Having fun. Taking it easy. | selectable |
| `focused` | Focused | Trying hard. Getting better. | selectable default |
| `dedicated` | Dedicated | No chill. All gas. | selectable |
| `unhinged` | Unhinged | Blood. Sweat. Victory. | selectable |
| `custom` | Custom | Make your own legend. | unlockable/custom mode |

The labels and captions are UX language, not the whole semantic contract. The
tables below are the current semantic capture.

## Brand vs Contract

The early "sweatiness scale" image was useful ideation, not a target visual
direction. It was deliberately off-brand, but it exposed the structure: players
understand a fast emotional ramp before they understand the reward model.

That ideation layer answered the emotional onboarding question:

```text
How hard do you horse?
```

The locked companion surface answers the product question:

```text
What shape does your play actually have?
```

That contrast is the point. The eventual surface can keep the clarity and humor
of a recognizable intensity ramp without inheriting the off-brand aesthetic. The
detail layer should quietly undercut the vibe with specific assumptions. The
joke is safe because the product contract is fair.

## Interaction model

Clicking a preset does not immediately mutate the saved planner configuration.
It opens a companion surface for that preset.

For curated presets, the companion surface shows the assumption controls as
visibly locked. They explain what the preset means; they are not an invitation to
tweak it. The language should be player-facing, not implementation-facing:
"how hard I chase PvP" or "how active my club is", not reward table IDs.

Preset selection is staged:

- Opening a preset preview does not recalculate the timeline.
- Locked controls in a curated preset cannot be moved.
- Apply commits the selected preset, runs one full timeline recalculation, and
  closes the companion surface.
- Closing or backing out without Apply discards the staged preset selection.

Custom uses the same surface but fully unlocks the controls. It is for players
whose real play pattern does not fit the curated archetypes, and it is a clean
future hook for Patreon support or similar. Most players should be well served by
the presets.

### Unified Trainer form

The mobile proof point proved better than the desktop surface book and replaced
it. The standard Identity menubar item now opens
`ui/views/trainer/trainerPage.ts` on every device.

The composition is shared while its presentation is capability-driven:

- touch phone (`pointer: coarse`, no hover, short viewport edge ≤600px) →
  fullscreen Trainer page;
- touch tablet or fine-pointer desktop → Trainer anchored to the left menubar
  dropdown rail, independent of Resources on the right.

The policy composes Godolphin's qualitative capability store
(`ui/caps/capabilities.ts`) with Darley's quantitative viewport extent in
`ui/caps/trainerPresentation.ts`. CSS renders the selected presentation; it does
not infer device class independently.

- Trainer identity and Play Style form one native-scrolling page.
- The selected preset's Participate, Engage, Challenge, and Compete sections are
  permanently expanded in document flow.
- Curated preset controls remain visible and read-only; Custom uses the same
  expanded form with editable controls.
- Apply and Discard remain pinned at the bottom of the page.
- Oshi, Club, and Cloud keep their existing small overlay/modal flows. The
  portrait proof point does not redesign them.

The old two-window `playStyleMachine.ts`, Trainer Card, drawer surface, and
height-matching surface book were removed. The unified page keeps its own local
staged preset/settings and consumes the shared section inventory and controls
from `ui/views/surfaces/playStyleSettings.ts`.

The product analogy is graphics presets:

| Graphics settings | Horsetrader |
| --- | --- |
| Low / Medium / High / Ultra | Sweetie / Casual / Focused / Dedicated / Unhinged |
| Advanced graphics menu | Custom playstyle controls |
| Preset changes many settings at once | Preset changes reward assumptions at once |
| Apply avoids thrashing rendering | Apply avoids thrashing timeline projection |
| Ultra is fully usable without Advanced | Unhinged gives the max curated assumptions without Custom |

That makes Custom a convenience and identity feature, not a ransom note. The
curated ceiling preset is free; Custom is for players whose actual play pattern
is unusual enough that they want to argue with the knobs.

## Semantic layers

Each preset has three meanings that should stay distinct:

| Layer | Meaning | Example question |
| --- | --- | --- |
| UX label | What the player sees and emotionally understands | "Do I recognize myself here?" |
| Archetype | The behavioural profile the product believes this represents | "How does this player engage with the game?" |
| Assumptions | The planner inputs seeded from that archetype | "Which income streams and PvP outcomes should this imply?" |

The UX label can be playful. The archetype and assumptions need to be boring,
testable, and versionable.

## Playstyle Summary

| Style | Archetype | Shape |
| --- | --- | --- |
| Sweetie | Weekend / occasional player | Not daily, avoids chore grinds, still notices some shiny events. |
| Casual | Regular player with real-life interruptions | Low consistency, high festival response; big events fund the gacha moments. |
| Focused | Daily-intent player | Usually keeps up, sometimes misses, builds for events without exhausting every edge. |
| Dedicated | Daily player | Reliable, completes chores, prepares seriously for PvP, but not assumed champion ceiling. |
| Unhinged | Competitive ceiling player | Chases ceiling outcomes through grind volume, optimization, account investment, or some combination. |
| Custom | Player-edited assumptions | Fully unlocked controls for off-diagonal play patterns. |

Dedicated and Unhinged intentionally share many collection ceilings. The split is
not login discipline: both show up. The split appears where human opposition,
score attack, or deep optimization creates a real competitive ceiling.

## At A Glance

Core engagement and recurring income:

| Stream | Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- | --- |
| Weekly play | 2 days | 4 days | 6 days | Every day | Every day |
| Team Trials | Rank 4 | Rank 5 | Rank 5.5 | Rank 6 | Rank 6 |
| Missions | 0% | 20% | 70% | 100% | 100% |

Campaign and event income:

| Stream | Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- | --- |
| Story events | Story | Welfare card | Major rewards | Achievement / stretch | Achievement / stretch, early |

Competitive PvP:

| Stream | Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- | --- |
| Champions Meeting | DNF / skips | Group B contender | Group B winner | Group A runner-up | Group A champion |

`DNF` is useful internal shorthand, but user-facing Sweetie copy should be
kinder: "Skips CM", "Doesn't finish", or "DNF" with a gentle tooltip.

## Streams

### Weekly play

Weekly play is the simplest assumption: how many days in a normal week the
player logs in and completes the normal daily loop.

- Counts daily tasks and weekly login bonuses.
- A counted day means more than opening the app: it includes baseline activities
  and a full career run.
- Treat a counted day as roughly a `30-60` minute commitment.
- Sweetie likely plays on weekends or occasional sessions.
- Casual plays often, but plans, work, family, and interruptions win.
- Focused makes an effort to do the loop daily, but sometimes misses.
- Dedicated and Unhinged do not miss days.

### Team Trials

Team Trials is a weekly PvP income stream, ranked on Mondays. Trainers enter
teams of three across five race types and compete in a ladder.

- The scale is the game's Rank `1-6`.
- It rewards roster depth more than one perfect unit.
- A healthy engaged pattern is a scenario-start scramble to rebuild all lanes,
  then honing those teams over the scenario.
- Values skew right because Cygames treats this as an engagement/progression
  system; reaching the middle-high ranks is cheap if the player shows up.
- Rank 6 is the cliff where competitive players live.
- Focused at `5.5` means the promote/demote flap: promoted into Rank 6, then
  often demoted straight away.

### Legend Races

Legend Races are short PvE windows that appear from time to time. They do not
take long; the real question is whether the player notices the event and spends
the daily attempts.

- A sequence starts with three days against one featured legend, then continues
  through `1-3` additional legends.
- First clear is chunky, with a notable carat reward per legend.

There is **no Legend Races slider**: the first-clear carats are baked onto every
legend-race event (`rewards.sequence`, one 250 per leg) and fold as ground-truth
income for every account. A slider could only have *down-graded* a low-engagement
plan, and the repeat-entry "daily" rewards aren't in the bake to begin with — so
the setting was removed rather than reshape a baked reward (see
[glue.md](glue.md), the `legend-races` audit verdict). Planners are engaged players
who collect the full reward anyway.

### Missions

Missions are frequent, low-grade engagement streams. They are almost always
running, and full completion often turns into chore routing.

- Completion targets can be high: for example `10` careers plus specific race
  wins.
- Some targets require off-path runs with trainees built for dirt, sprint, or
  another race type the player would not otherwise touch.
- This is a completion-rate stream, not a rank ladder.
- The curve is sharp: it measures willingness to do annoying homework more than
  capability.
- Sweetie does not intentionally grind them.
- Casual sometimes completes them by accident or during a high-engagement week.
- Focused usually completes them, but misses annoying sets or busy weeks.
- Dedicated and Unhinged complete all mission rewards.

### Special missions (deprecated, removed 2026-06-11)

There is no longer a special-missions slider. The large campaign mission sets it
described are the anniversary mission sets — now their own `anniversarymission`
event type, folded as **always-on ground-truth income** (you don't toggle whether
the anniversary missions happen). The only other event-mission format (Gold Ship
Week 1 & 2) was retired by Cygames and lives only in the past, so there is no live
source for a separate gradable slider. The slider never earned its place and was
deleted; see glue.md (the mission model, Axis 1).

### Story events

Story events are limited events that reward almost any play. They behave like
campaign events at the front and like chore missions at the tail.

- Early rewards are front-loaded around story chapters and welfare cards.
- Doing almost anything in the game advances the event.
- Stronger accounts clear the earliest stages faster.
- Past the welfare card, the event becomes a point/shop grind for major,
  achievement, and stretch rewards.
- This should be a milestone ladder, not a flat percentage. Welfare is not "half
  the event" in value terms; it likely captures a disproportionate amount of the
  useful casual-facing rewards.
- Sweetie plays enough to see the story.
- Casual plays enough to get the welfare card.
- Focused gets the major rewards.
- Dedicated completes achievement and stretch rewards.
- Unhinged completes achievement and stretch rewards as soon as practical.

Story events are another reason Casual should not be projected as poor. Casual
income is spiky: they miss daily discipline and boring missions, but the game's
big retention systems deliberately pull them toward welfare cards, selectors,
and event reward pools.

### Champions Meeting

Champions Meetings are high-stakes PvP events where trainers build dedicated
runners for a specific course. This is where the preset ladder stops being
mostly "how much income do you bother collecting?" and starts asking "how hard
do you fight other humans?"

Strong Champions Meeting results usually require serious investment along at
least two of three axes:

| Axis | Meaning |
| --- | --- |
| Time | Runs, rebuilds, retries, practice rooms, skill farming. |
| Thought | Meta reading, lane modelling, course mechanics, counter-picks. |
| Money / resources | Support deck strength, character access, inheritance depth. |

- Sweetie skips or DNFs Champions Meeting.
- Casual is a Group B contender: enters, races, and collects some payout.
- Focused is a Group B winner: builds for the event and can win the accessible
  bracket.
- Dedicated is a Group A runner-up: serious prep, hard bracket, strong result,
  but not assumed champion ceiling.
- Unhinged is Group A champion: brings whatever mix of grind volume,
  optimization, and account power is required to chase the ceiling.

This distinction will matter again for League of Heroes or any other PvP /
score-attack reward ladder.

## Open decisions

- Confirm final preset labels and whether "sweatiness" appears in-product or
  only remains internal shorthand.
- Decide the exact player-facing labels for each stream's locked controls.
- Decide whether Custom is a general advanced feature, a supporter feature, or
  both.
- Decide how to explain DNF / skipped PvP kindly in Sweetie-facing UI.
- Decide how much of the "sweatiness scale" brand language belongs in onboarding
  versus the companion surface.

## Related docs

- [Menu and Identity](menu.md)
- [Sweatiness preset exploration](../ideas/sweatiness-presets.md)
