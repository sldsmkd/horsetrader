# Debut

Status: **launched (2026-06-20); a few polish items remain open.**

Debut was not the feature-completion spike — Horsetrader was already
feature-complete after Eclipse. *Make Debut!* is the winners' concert song, and
Debut is the backstage moment before that concert: makeup, pinning the costume so
nothing slips on stage, checking the lights. **A readiness pass for being seen.**

- [done.md](done.md) — receipts for everything shipped during Debut, including the
  glass-table surface language and the shared surface components.
- [image-audit.md](image-audit.md) — the 2026-06-19 timeline image payload audit
  (decision: no resampling for launch).

## Thesis

Horsetrader already works; Debut makes it feel ready to meet players — visible
polish, copy, first impression, performance, trust signals, and the small external
chores that make a fan-built tool legible and shareable without pretending it is a
commercial launch.

The timeline is the product. Everything else is a glass table on top of it, and
Debut must make that world feel confident, not replace it with a "homepage".

Earlier arcs had hard technical centres (**Eclipse** — the economy engine;
**Trackblazer** — the renderer; **Unity** — cloud save). Debut is a mixed board of
small practical tasks; its coherence is "the site is ready to walk onstage".

**Working rule:** if a task makes Horsetrader more ready to be seen by real
players, it belongs here. If it opens a new product direction, changes the core
contract, or rebuilds a subsystem, it belongs in a later named arc.

Non-goals: a new economic model, a renderer rewrite, another cloud pass,
monetisation/growth work, or a broad tutorial project.

## Lanes (what "ready" covered)

- **Presentation polish** — CSS awkwardness, placeholder surfaces, spacing and
  rhythm, an intentional first viewport.
- **Copy and comprehension** — labels, empty states, save feedback, the
  player-to-player voice rather than marketing tone.
- **First-run readiness** — use the [first-run feedback](../../frontend/feedback/2026-06-04-first-run.md)
  as signal; make add/remove and affordability obvious in context.
- **Performance and delivery** — measure before speculative work; keep the
  static, low-cost posture.
- **Trust and hygiene** — cared-for errors and loading states, privacy posture,
  credits and disclaimers.
- **External chores** — what "announcement" means for a fan tool, share text in
  community language.

## Open board

- **Favourites star fruit** — replace the emoji favourite marker with custom art.
- **Banner pull icons** — final custom art (Aseprite pass).
- **Aseprite placeholder icons** — clean ripped in-game assets into proper
  transparent item icons at UI scale. Reward icons are 256×256 shown at `0.82rem`;
  this is art polish, not performance.
- **Pre-hydration / first paint** — largely answered by the
  [12 Billion Yen Incident](../12-billion-yen-incident.md) landing sequence.
- **Share-ready surfaces** — README pointers, screenshots/clips,
  credits/disclaimers, announcement text.
- **Play the damn game** — schedule enough real human time to close out the current
  story. Debut polish shouldn't eat the game window the planner exists to serve.

## Parked during Debut — where each went

| Idea | Outcome |
| --- | --- |
| Tazuna first-run / announcement flow (`firstrun` counter, one-shot steps) | **Shipped** as [Special Week](../special-week.md). |
| Floating timeline chrome + mobile | **Graduated** to [Grand Masters](../grand-masters/README.md) (shipped). |
| Favourites / Plan surface identity, and drawer ↔ Identity layering | **Dissolved** — the drawer was replaced by the film strip and the Desk ([Twinkle Monthly](../twinkle-monthly/README.md)); the Trainer became one page. |
| Plan share shield / screen-grabbable report | Parked as **To Press** in [Twinkle Monthly](../twinkle-monthly/desk.md). |
| Grouped banner mixed-end copy (groups keyed on shared start, rare mixed ends) | Still open — not launch-critical. |
