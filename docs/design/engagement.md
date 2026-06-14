# Engagement Economy Groups

This note captures the analysis taxonomy behind the anniversary economy reports.
It is a design artifact, not a baked-data contract: the stream ids below are the
current report/engine names, and the group names are the vocabulary we want to
use when shaping playstyle and advanced controls.

The core distinction is that income streams do not all belong on one
"sweatiness" slider. Some are account-state modifiers, some are regular
engagement loops, and some are difficulty-gated modes. The report charts group
streams so we can see those patterns before turning them into UI.

## Playstyle Axes

These groups describe how a player engages with the game. The classifier has
five behavioral axes:

- **participate** — showing up for the game: stories, holidays, login rhythms,
  and the front-loaded rewards that say "I was there."
- **engage** — choosing to do the weird little events that come along and
  need some effort: schedule cards, mission sets, and mode-specific chores.
- **compete** — "I am here to beat other players and prove I am the
  strongest": ranked PvP, tournaments, and roster-vs-roster outcomes.
- **challenge** — "I will take the strongest content the game can throw at me
  and beat it": PvE clear-level outcomes against power/strategy checks.
- **off-axis modifiers** — paid/subscription and account/social state, which are
  economic modifiers but not playstyle.

### participate

Main-screen loops, onboarding, shop participation, story/event milestones, and
big retention beats: income you mostly get by showing up for the game's stories,
holidays, and ordinary rhythms. These can be big calendar moments in LiveOps
terms, but the player behavior is participatory rather than competitive,
engaged-effort, or challenge-clearing.

- `event.trainee-debuts` — the 80 free carats stamped on first Original trainee
  debuts. This is passive account progression and is on for every playstyle.
- `event.anniversary-missions`
- `event.holidays`
- `event.scenario-missions`
- `play.dailies` — daily-mission carats, modelled as a plain on/off play
  assumption.
- `play.weekly-login` — the 7-login bonus cycle, also modelled as a plain
  on/off play assumption.
- `play.shop-tickets` — monthly shop tickets bought with engagement-derived
  currencies such as cleats and friend points.
- `play.team-trials` — early onboarded recurring loop.
- `play.story`

### engage

Schedule-card grinds and mission sets: these are not difficulty/outcome
selectors, but they are also not passive participation. The player chooses to
engage with the odd little event assignment and put in some effort.

- `event.factor-studies`
- `event.racing-carnival`
- `event.showtime`
- `event.missions`

### compete

Team PvP and ranked competition. The emotional register is proving strength
against other players; the economy outcome is driven by meta knowledge, team
quality, roster breadth, and ranking/placement.

- `play.champions-meeting`
- `play.league-of-heroes`
- `play.strongest-team`

### challenge

PvE modes where the player is asking for the strongest content the game can
throw at them and trying to beat it. The economy outcome depends on clearing a
real power or strategy check, rather than merely showing up.

- `event.legend-races`
- `event.skill-tests`
- `play.masters-challenge`

## Off-Axis Modifiers

These affect the economy, but they are not playstyle. They already have homes
outside the main playstyle sliders.

### dolphin

Paid/subscription income.

- `subscription.daily-pack`
- `subscription.training-pass`

Design placement: both are surfaced in the Resources area. They should stay
there as account/subscription state, not join the playstyle preset ladder.

### social

Social/account-state income.

- `identity.club-rank`

Design placement: club rank belongs with trainer identity in the Trainer
surface. It is an account/social-state selector, not a playstyle slider.

## Design Implications

The playstyle surface should not be treated as one ordered ladder. The streams
above imply three different control families:

- Main playstyle presets should describe broad engagement with regular loops and
  beats: dailies, weekly login, Team Trials, shop participation, story-event
  depth, and anniversary/holiday/scenario missions.
- Engagement streams should be separate binary participation gates: Factor
  Studies, Racing Carnival, Showtime, and regular missions.
- Competitive and challenge streams are outcome selectors. Champions Meeting,
  League of Heroes, Strongest Team, and Masters Challenge should be labelled as
  expected result/clear level, not as generic effort.
- Dolphin and social streams are account-state modifiers with existing UI homes:
  Daily Pack and Training Pass in Resources, club rank in the Trainer surface.

Known economic quantities should remain facts, not playstyle inventions. When a
stream currently contains such a number because the ETL does not yet bake it, the
design stance is to document the assumption and treat a later config/ETL move as
the proper implementation path. Do not patch generated `static/json/config.json`
for this design pass; it will be clobbered by the next bake.

Current code-side assumptions to retire through a future contract/config change:

- `play.shop-tickets` maps participation brackets to monthly ticket counts
  directly in the site stream. The design vocabulary is still correct — `none`,
  cleats, friend points, all shops — but the 4/6/7 ticket counts are economy
  facts and should eventually come from baked config if this stream graduates
  from analysis/design into a contract change.

## Exercise 1: Slider/Tunable Deconstruction

Purpose: deconstruct the current controls one by one, then decide what each of
the five named playstyles should mean conceptually. The "current value" rows
below are a snapshot of the existing site assumptions, not the target design.

When working through a row, answer four questions before changing labels or
defaults:

- What player behavior does this actually measure?
- Is it a broad playstyle axis, an outcome selector, or off-axis account state?
- Is the current value an economy fact, a UI vocabulary choice, or a temporary
  code assumption?
- Should the five presets control it directly, seed it loosely, or leave it to
  advanced/custom controls?

### Current Playstyle Defaults

| Tunable | Family | Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- | --- | --- |
| Dailies | participate | On | On | On | On | On |
| Weekly login | participate | On | On | On | On | On |
| Team Trials | participate | Rank 4.5 | Rank 5.0 | Rank 5.5 | Rank 6.0 | Rank 6.0 |
| Anniversary missions | participate | On | On | On | On | On |
| Holidays | participate | On | On | On | On | On |
| Scenario missions | participate | On | On | On | On | On |
| Trainee debuts | participate | On | On | On | On | On |
| Factor studies | engage | Off | Off | On | On | On |
| Racing Carnival | engage | Off | Off | On | On | On |
| Showtime | engage | Off | Off | On | On | On |
| Missions | engage | Off | Off | Off | On | On |
| Story events | participate | On | On | On | On | On |
| Champions Meeting | compete | Off | Group B contender | Group B winner | Group A runner-up | Group A champion |
| Shop tickets | participate | None | 4 / month | 4 / month | 6 / month | 7 / month |
| League of Heroes | compete | Off | Gold 2 | Gold 4 | Platinum 1 | Platinum 2 |
| Strongest Team | compete | Off | C | A | S | SS |
| Legend Races | challenge | Off | Off | On | On | On |
| Skill Tests | challenge | Off | Off | Off | On | On |
| Masters Challenge | challenge | Off | Level 3 | Level 2 | Level 1 | EX |

### Per-Tunable Notes

#### Dailies

Behavior measured: whether the player normally opens the game and clears daily
missions.

Economic facts: daily missions currently come from `reward_structures.dailies`
(75 free carats per enabled day).

Design read: broad playstyle axis, but binary. The observed casual-player
sample supports "casual can be daily" more than it supports a 2/4/6/7 cadence
ladder, so the control should be on/off rather than a pretend frequency model.
For now all five presets count dailies as on.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Weekly login

Behavior measured: whether the player normally collects the login reward cycle.

Economic facts: the weekly-login cycle comes from
`reward_structures.weekly-login` (25, 0, 25, 0, 25, 0, 75 free carats over seven
enabled days).

Design read: broad playstyle axis, but binary. It is separate from dailies
because the economy source is separate and a player may conceptually count one
without the other. For now all five presets count weekly login as on.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Team Trials

Behavior measured: weekly team rank maintenance or class flapping.

Design read: participate, with some account-strength leakage. Class
1 is tutorial-only: the first forced competition promotes the account
immediately, and demotion back into Class 1 is not possible. The slider should
therefore expose the real steady-state class ladder: 2.0, 2.5, 3.0, ..., 5.0,
5.5, 6.0. Whole ranks are retention rows; half ranks alternate promotion into
the higher class and demotion into the lower class. Current preset defaults:
Sweetie 4.5, Casual 5.0, Focused 5.5, Dedicated 6.0, Unhinged 6.0.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Missions

Behavior measured: whether the player chases regular mission-card events.

Design read: engage participation gate, not a percentage. Anniversary and
scenario missions fit the broader participation group; this tunable is only the
regular `event.missions` stream. Sweetie, Casual, and Focused leave it off;
Dedicated and Unhinged opt in.

#### Minor schedule-card events

Behavior measured: whether the player engages with the minor limited event
families: Factor Studies, Racing Carnival, and Showtime.

Design read: engage gates. Sweetie and Casual leave these off; Focused,
Dedicated, and Unhinged opt in. The values remain baked event rewards; the
playstyle only decides whether those event families are present.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Story events

Behavior measured: whether the player shows up for time-limited story events.

Design read: participate gate. Story events are major LiveOps beats by
schedule, but the player behavior fits the same participation pattern as daily
login, holidays, scenario missions, anniversary missions, and trainee debuts:
show up and collect the baseline story rewards. The deeper event ladder was
researched separately, but it is too fine-grained for the playstyle classifier.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
| On | On | On | On | On |

#### Champions Meeting

Behavior measured: expected PvP finish.

Design read: compete outcome selector. The preset can seed a default, but
the control itself should not pretend to be the same kind of slider as weekly
play or story-event depth.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Shop tickets

Behavior measured: whether the player buys monthly scout tickets from
engagement-currency shops.

Design read: participate / shop awareness. The bracket labels are good
playstyle vocabulary; the current 4/6/7 ticket counts are economy assumptions
that should eventually be baked if this becomes contract work.

Current preset defaults: Sweetie buys 0 of each monthly scout-ticket type;
Casual and Focused buy 4 of each; Dedicated buys 6 of each; Unhinged buys 7 of
each.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### League of Heroes

Behavior measured: expected ranked PvP tier.

Design read: compete outcome selector. Sweetie is no participation; the other
presets currently seed Gold 4, which is intentionally a midpoint placeholder,
not a final conceptual statement.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Strongest Team

Behavior measured: expected team-building event rank.

Design read: compete/team-roster outcome selector. Sweetie is no participation;
the other presets currently seed B as midpoint scaffolding. It overlaps
engagement, roster breadth, and account age, so it may belong in advanced
controls even if presets seed it.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Legend Races

Behavior measured: whether the player clears recurring Legend Race challenge
content.

Design read: challenge participation/clear gate. Focused, Dedicated, and
Unhinged count these rewards; Sweetie and Casual leave them off.

#### Skill Tests

Behavior measured: whether the player clears Skill Test challenge content.

Design read: challenge participation/clear gate. Dedicated and Unhinged count
these rewards; Sweetie, Casual, and Focused leave them off.

#### Masters Challenge

Behavior measured: highest PvE challenge clear.

Design read: challenge outcome selector. This should read as clear level,
not general sweatiness. The reward ladder ascends 1→2→3→EX (1500→3000→4500→4500+
carats), so a higher level is the harder, higher-reward clear. Preset defaults:
Sweetie off, Casual Level 1, Focused Level 2, Dedicated Level 3, Unhinged EX.

Open verdict:

| Sweetie | Casual | Focused | Dedicated | Unhinged |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Report Valuation Lens

The raw matrix remains raw by default. The optional carat-equivalent report adds
a synthetic `carat_equivalent` resource so unlike rewards can be compared on one
axis.

Current analysis-only rates:

- `free_carats`: 1
- `paid_carats`: 2, because 50 paid carats can become one discounted daily pull
  when used efficiently.
- `trainee_tickets`: 100, discounted from the full 150 carat pull value because
  tickets are banner-side limited.
- `support_tickets`: 100, same reasoning.
- `rainbow_crystal`: 5000
- `rainbow_crystal_shards`: 250, because 20 shards make one crystal.
- `gold_crystal`: 2500
- `gold_crystal_shards`: 125, half rainbow value.

The crystal valuation is intentionally curated rather than market-priced:
crystals cannot be bought directly, twice-yearly equivalents exist around 1500
and 7500 paid carats, and roughly 20000 carat equivalents exist but are poor
deals. The report pegs a rainbow crystal at 5000 carats as the working midpoint.
