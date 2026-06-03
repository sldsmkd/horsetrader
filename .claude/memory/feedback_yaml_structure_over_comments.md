---
name: feedback-yaml-structure-over-comments
description: "In curated static YAML, prefer load-bearing structure (named blocks, keys) over comments. The structure is guaranteed; comments aren't, and tz offsets are easy to lose."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

When designing curated static YAML, prefer **load-bearing structure** — named blocks, explicit keys — over comments that communicate the same information. The structure is enforced by the loader; the comment is a vibe.

**Why:** During the 2026-05-29 holidays merge, the user trialled a hypothetical alternative shape for `new-year-2027`:

```yaml
new-year-2027:
  start:
    - 2022-01-01T05:00:00+09:00 # JP drop time for New Year 2022
    - 2026-01-27T22:00:00+00:00 # EN drop time for New Year 2022
```

vs. the established namespace shape:

```yaml
new-year-2027:
  jp:
    start: 2022-01-01T05:00:00+09:00
  en:
    start: 2026-01-27T22:00:00+00:00
```

The list shape relies on tz-offset inference (`+09:00 → JP`) and inline comments to communicate region. Two failure modes surfaced immediately:

1. The user's own trial example showed comment drift — both comments said "New Year 2022" but the key was `new-year-2027` (copy-paste from the example above).
2. The user noted "the TZ is easy to lose" — e.g. a `+09:00` typo'd to `+9:00` or dropped to a naive datetime has no structural contradiction to catch it.

After I argued for namespaces, the user confirmed: *"i think you are correct, the key is guaranteed - the comment isn't and the TZ is easy to lose."*

**How to apply:**

- New per-region fields in static YAML → put them in `jp:` / `en:` blocks (see [[project-static-yaml-region-namespace]]), not in lists ordered by convention.
- Don't use comments to communicate facts the loader could verify — if the loader could check it, the YAML should be shaped so it does.
- This unlocks cross-validation between block name and content. The holidays loader (as of 2026-05-29) enforces `jp.start.tzinfo == JST` and `en.start.tzinfo == UTC` and **raises `ValueError`** on mismatch (see [[feedback-curated-yaml-fails-loud]] for why this is hard-error, not warn-and-skip). Apply the same check + same fail-loud stance to the anniversaries / scenarios loaders when they merge.
- Related: [[feedback-fq-timestamps-in-yaml]] (timestamps stay fully qualified inside the block).
