---
name: project_league_of_heroes_todo
description: "League of Heroes (LoH) is an unmodelled competitive event type; revisit CM prediction when it lands. We don't have LoH data yet."
metadata: 
  node_type: memory
  type: project
  originSessionId: 03d49c67-59e3-43d8-b90b-de080e7f87b9
---

**Open frontier (not started):** League of Heroes (LoH) is a competitive PvP event
("super CM") that JP runs *instead of* a Champions Meeting in certain months. We do
**not** scrape or model it yet — no data, don't know its exact structure.

What we know from the cadence research (references/research/Umamusume Release Cadence
Analysis.md):
- From 2025 JP runs a **hybrid 8 CM + 4 quarterly LoH** calendar; LoH lands roughly
  Feb / May / Aug / Nov, replacing the CM that month.
- This is why our scraped CM ordinals have month gaps (e.g. May & Aug 2025 absent) —
  those are LoH months. Our `ChampionsMeetingPredictor` is robust to this (it only
  maps scraped CMs; LoH months are simply absent), but the baked timeline will show
  an empty month where Global actually has a major PvP event.
- The zodiac→category CM transition at **cm-025** is the same inflection where JP
  began interleaving LoH; Global hits it at the cm-024→025 boundary (Global currently
  ~cm-014, early in its 2nd zodiac lap). So LoH becomes relevant to Global around then.

**Why revisit CM code when LoH lands:** the solo-banner anchor + final-mapper in
`timeline/predictors/champions_meeting.py` assumes CM-only. LoH likely shares the same
whale-CTA banner coupling (the day-20 solo new-character banner — see docs/domain.md (Champions Meetings)
and the predictor docstring) and probably a similar two-window (competition vs
availability) shape, but UNVERIFIED. Don't assume; recon LoH structure first like we
did for CM (docs/howto-new-extractor.md). Related: docs/domain.md (scenario beats).
