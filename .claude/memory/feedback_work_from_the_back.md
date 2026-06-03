---
name: feedback-work-from-the-back
description: "When introducing a shared layer, start with the minimum primitives and let patterns lift themselves up over time. Don't pre-design the full abstraction at N=2."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

When extracting shared infrastructure across N entities, **start at the back** — build a thin primitive layer for what's already byte-for-byte duplicated, leave entity-specific orchestration in place, and let further generalisations surface naturally as more entities join.

**Why:** Said by the user on 2026-05-29 after I'd proposed a `store.py` primitive layer for the consolidated static YAMLs (holidays + stories at N=2, with anniversaries + scenarios coming later): *"yes; the store just returns a dict - the logic of what to do with it belongs upstream - although we'll probably find that is generalizable - so just work from the back - see what sticks and move up over time."*

This is the same instinct as "Three Strikes" / Rule of Three but expressed positively — don't refuse abstraction at N=2, just don't pre-design for N=4 either. Build the small thing that obviously rhymes (here: yaml I/O, locale block lookup, tz validation). Wait to see what the next two concrete cases do before pulling more up.

**How to apply:**

- New shared layer: ship the *smallest* primitive that removes literal duplication. No declarative schema language, no parameterised mega-loader, no plugin registry.
- Entity-specific orchestration stays per-entity. If the same orchestration pattern appears in 3 of 4 entities, *then* it's a candidate to lift.
- "What sticks" = lines that appear identical (modulo entity label) across multiple consumers. "What doesn't" = the field schema / output container shape that differs even when the storage pattern matches.
- Concrete example: `extractors/static/store.py` exposes `load(filename)`, `overlay(filename, key, locale)`, `shared(filename, key)`, `require_zone(value, expected, label)`. Each entity loader (`holidays.py`, `stories.py`) drives that with its own key validation, field extraction, and output dict/list shape. When anniversaries + scenarios land, look at whether the per-entity loops rhyme — *then* decide whether to introduce e.g. an iterator helper.
- Related: [[project-static-yaml-region-namespace]], [[feedback-yaml-keys-match-stable-keys]], [[feedback-curated-yaml-fails-loud]] — the established conventions that any future generalisation has to preserve.
