# Menu Bar & Stable Identity Design

## Overview

The timeline remains the application.

This design intentionally avoids introducing a dedicated Account page. Instead, account state is decomposed into two lightweight dropdown surfaces attached directly to the menu bar:

- **Identity** ("Who am I?")
- **Resources** ("What do I have?")

These are persistent pieces of player state rather than destinations in their own right.

The timeline remains the primary interaction surface.

---

## Menu Bar Layout

```text
[Home] [Date] [Representative Uma ▼] [Search.............................] [Balance ▼] [Tazuna]
```

### Left Side

Represents stable identity.

```text
Home
Date
Representative Uma
```

These answer:

> Who is looking at this timeline?

### Center

Discovery and navigation.

```text
Search
```

Used to locate:

- Trainees
- Support cards
- Events
- Banners
- Stories

Search remains independent from account state.

### Right Side

Planning state.

```text
Balance
Tazuna
```

These answer:

> What can I spend?
>
> How do I understand the planner?

---

# Identity Dropdown

The current "Account" page becomes the Identity surface.

This is conceptually equivalent to a Trainer Card or Stable Card.

## Purpose

Identity is not planner configuration.

Identity is:

- Who represents the stable
- Club affiliation
- Play style
- Optional trainer identity

## Layout

```text
Sweep Tosho

Representative Uma
Sweep Tosho

Club
UmaDen (B+)

Play Style
Competitive

Trainer ID
765•••••••••
```

---

## Representative Uma

Primary stable identity.

Uses existing circular Uma icons.

### Purpose

- Menu avatar
- Stable identity
- Future social features
- Future sharing/export
- First-run onboarding

### Notes

Representative Uma has no gameplay impact.

This is intentionally similar to the game's "Star Umamusume" concept:

> The horse that represents your stable.

Not:

> Your strongest horse.

Not:

> Your favourite horse.

Though in practice those may coincide.

---

## Club

Club is treated as identity rather than forecasting configuration.

Reasoning:

- Players identify with clubs
- Clubs are social groups
- Players discuss clubs naturally
- Similar to sports team affiliation

Examples:

```text
UmaDen
B+
```

Club rank remains available as metadata but is not elevated into a player power metric.

---

## Trainer ID

Optional.

Purpose:

- Stable hash generation
- Poll deduplication
- Future social features
- Potential sharing links

Not authentication.

Not security critical.

Merely a stable identifier.

---

## Play Style

High-level engagement archetype.

This replaces exposing dozens of forecast assumptions directly.

Examples:

```text
Very Chill
Casual
Competitive
Degenerate
Custom
```

The selected archetype seeds planner assumptions.

Advanced users can override later.

---

## Future Expansion

Identity naturally becomes home for:

```text
Roster
Supports
Collection
```

These are things the player owns and identifies with.

---

# Resources Dropdown

The current balance modal becomes the Resources surface.

## Purpose

Resources answer:

> What can I spend?

Not:

> Who am I?

---

## Layout

```text
Pull Economy

Carats              39,528
Trainee Tickets          42
Support Tickets          11

Recovery Assets ▼
```

---

## Pull Economy

Primary planning currencies.

### Carats

Most important planner resource.

Always visible.

### Tickets

Tickets are treated as first-class pull currency.

Reasoning:

Players naturally think:

```text
34k carats + 42 tickets
```

rather than:

```text
34k carats
```

Tickets belong alongside carats, not alongside miscellaneous inventory.

---

## Recovery Assets

Secondary planning resources.

Collapsed by default.

```text
Rainbow Crystal
Gold Crystal

Rainbow Shards
Gold Shards
```

### Purpose

Recovery assets answer:

> What happens if the banner goes badly?

Rather than:

> Can I pull?

These are not primary savings resources.

They are banner recovery mechanisms.

---

## Snapshot Date

Resources remain tied to a timeline snapshot.

```text
Balance on May 28, 2026
```

The snapshot remains visible within Resources rather than occupying space in the primary UI.

---

# Tazuna

Tazuna remains separate from Identity.

## Purpose

Help and understanding.

Tazuna answers:

> What does this mean?

Examples:

- Planner explanations
- Forecast explanations
- Onboarding
- Tooltips
- Documentation

---

## Important Distinction

Representative Uma:

```text
This is me.
```

Tazuna:

```text
This is help.
```

These concepts should remain visually and structurally separate.

---

# First Run Experience

## Goal

Collect only enough information to make the planner useful.

Avoid spreadsheet-style onboarding.

---

## Step 1

Choose a representative Uma.

```text
Who represents your stable?
```

Select from circular Uma icons.

---

## Step 2

Enter current carats.

```text
How many carats do you have?
```

This is information every player already knows.

---

## Step 3

Choose play style.

```text
How do you usually play?
```

Examples:

```text
Very Chill
Casual
Competitive
Degenerate
```

This seeds forecasting assumptions.

---

## Optional

```text
Club
Trainer ID
```

May be skipped.

---

# Design Principles

## Timeline First

The timeline remains the application.

Identity and Resources are supporting surfaces.

---

## Progressive Disclosure

Most users should never see:

- Weekly login state
- Daily pack days remaining
- Monthly ticket assumptions
- CM forecasting parameters

These belong behind:

```text
Advanced Settings
```

---

## Identity Before Configuration

The planner should first answer:

```text
Who are you?
What do you own?
```

Only then expose:

```text
How should forecasts behave?
```

---

## Stable Card Philosophy

The design is closer to:

```text
Trainer Card
```

than:

```text
Account Settings
```

Identity is a first-class concept.

Configuration is secondary.

---

# Future Direction

The menu bar becomes the stable substrate for future growth.

Potential future additions:

Identity:
- Roster
- Supports
- Collection progress

Resources:
- Pull history
- Plan summaries
- Forecast deltas
- Banner affordability

Without introducing new top-level navigation.

The timeline remains the center of the application.