---
name: feedback-allowlist-drops-are-debug
description: "When a scrape is intentionally allowlisted (only known/typed entries kept), the drops are expected — log them at debug, not warning. Warning is for surprise."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9315e8dd-1778-4249-9fc8-3b3cb0a5e99f
---

When code filters a scrape down to a typed/allowlisted subset (e.g. `reward_for_gametora_icon` returning `None` for icons without a typed `Reward` subclass), the unmatched rows are **expected**, not a problem to surface. Log at `debug` (or omit entirely) — never `warning`.

**Why:** Warning is reserved for "this looks wrong, a human should notice." When the design is "we intentionally only handle these N item-ids, the other ~170 in Gametora's catalogue are out of scope," every scrape will print a long tail of unmatched-icon noise the user has to read past. The story-event scrape was emitting `WARNING - Unknown reward icon 00059 in story-event-53 (x50000)` etc. on every run; the user called it noise because it is — the long tail is by design, not a regression.

**How to apply:**
- Warning level: "this matched my filter shape but had an unexpected value" (e.g. icon id matched the typed table but the amount text didn't parse — that's a real shape mismatch).
- Debug level: "this didn't match my filter and I'm allowlisting, so I'm dropping it" — that's the design, not an alarm.
- Wording also matters: prefer "unmapped" over "unknown" when allowlisting — "unknown" reads as "I expected this and it's missing" which is wrong; "unmapped" reads as "I didn't choose to handle this," which is accurate.
- Update the surrounding comment so the next reader understands the drop is intentional rather than a TODO to extend the allowlist.

See docs/domain.md (Rewards) — `Reward.__subclasses__()` walk is the typed allowlist; the `Items` collection still has the full catalogue if a downstream consumer wants the long tail.
