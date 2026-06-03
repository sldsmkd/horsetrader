---
name: feedback-curated-yaml-fails-loud
description: "For hand-curated `config/*.yaml`, prefer `raise ValueError` over `Logger.warning` + skip. The next pipeline run is the editor's IDE feedback loop — don't bury malformed entries in logs."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

In the ETL pipeline, the per-entity-recoverable pattern (`Logger.warning(...)` + `continue`) is for **scraped / noisy upstreams** where one bad entry shouldn't kill the whole batch. **Curated `config/*.yaml` is different** — every entry was hand-typed by a human. If validation fails, the right time to surface it is **right now, while the YAML is still open in their editor**, not a week later when someone notices a missing event in the baked output.

**Why:** Said by the user during the 2026-05-29 holidays merge after I'd shipped warn-and-skip validation for tz-zone mismatches: *"probably worth raising an Error; if its changed it's because a human has changed the yaml recently - break fast while they still have it open in IDE."* Aligns with `docs/standards.md` "Fail loud" — library code raises on invariant violation; per-entity warn-and-continue is only the right call when continuing is genuinely useful (batch enrichment failures, scraper-side noise).

**How to apply:**

- Static YAML loaders (`extractors/static/*.py`) → `raise ValueError(f"{path}: <key> <field> ...")` on structural / type / tz mismatches. Include the file path and the offending key in the message so the editor can jump straight to it.
- Don't catch and downgrade these to warnings to keep the rest of the load running. The whole point is to break fast.
- Scraped extractors (`extractors/gametora/*`, `extractors/umapyoi/*`) → stay on the warn-and-skip pattern, because their upstreams have long tails of expected noise and the curator can't fix Gametora.
- This applies to the upcoming `anniversaries.yaml` / `scenarios.yaml` merges; the holidays loader is the template.
