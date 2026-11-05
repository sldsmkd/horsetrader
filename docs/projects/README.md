# Projects — the named arcs

Horsetrader work that is bigger than a ticket runs as a **named arc**: a codename
borrowed from the game, a one-line thesis, and a folder of design → worklog →
verdict. The arc is the project record. When it lands, its durable rules graduate
into the living docs ([`../frontend/`](../frontend/), [`../etl/`](../etl/),
[`../contract.md`](../contract.md)) and the arc doc keeps the *why*, the
reversals, and what was deliberately not done.

**If an arc doc and a living doc disagree, the living doc wins** — arcs are
history once shipped.

| Arc | Thesis | Status | Durable docs |
| --- | --- | --- | --- |
| **Eclipse** | the economy engine as a pure core | shipped | [engine.md](../frontend/engine.md), [projection.md](../frontend/projection.md) |
| [**Trackblazer**](trackblazer/trackblazer.md) | the timeline renderer scales (scene model → cull → zoom) | shipped | [ui-timeline.md](../frontend/ui-timeline.md) |
| [**Unity**](unity/README.md) | one account, one save — cloud sync | shipped 2026-06-19 | [cloud-sync.md](../frontend/cloud-sync.md), [persistence.md](../frontend/persistence.md), [`horsetrader.cloud/`](../../horsetrader.cloud/README.md) |
| [**Debut**](debut/README.md) | readiness pass for being seen | launched 2026-06-20 | [ui-surfaces.md](../frontend/ui-surfaces.md) |
| [**Grand Masters**](grand-masters/README.md) | glass HUD discipline + real devices + phones | shipped 2026-07-03 | [glass.md](../frontend/glass.md), [typography.md](../frontend/typography.md) |
| [**Twinkle Monthly**](twinkle-monthly/README.md) | the trainer's intent is the story — notes, film strip, the Desk | Desk in discovery | [persistence.md](../frontend/persistence.md), [ui-surfaces.md](../frontend/ui-surfaces.md) |
| [**Special Week**](special-week.md) | the first day — Tazuna's one-shot tour | shipped 2026-06-24 | [menu.md](../frontend/menu.md#first-run-tazunas-tour) |
| [**12 Billion Yen Incident**](12-billion-yen-incident.md) | the start — get out of the gate clean | done 2026-06-24 | [architecture.md](../frontend/architecture.md#startup-the-landing-sequence) |

Eclipse predates this folder and has no arc doc of its own.

## Starting a new arc

Add a folder (or a single file for a small arc) here, add a row above, and give
it a `Status:` line at the top. Keep live working state in the arc doc while it
runs; when it ships, move the rules into the living docs and leave a pointer.
