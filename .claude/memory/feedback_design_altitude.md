---
name: feedback-design-altitude
description: "When designing infrastructure/architecture with the user, stay at general principles/mechanisms first — don't prematurely dive into the specific data model or field-level \"what\"."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d03f9c59-e8bb-4d73-8651-868e3c257a88
---

When working through architecture/infrastructure with the user, discuss **general
principles, boundaries, and mechanisms** first — plus the few hard-to-reverse
decisions. Don't prematurely concretize into the specific data model, field names,
or exact shapes; that's "the what," and it belongs at build time.

**Why:** the user is a principled engineer who wants the foundations/abstractions
right before the specifics; settling the "what" too early bakes in detail before
the principle is agreed, and wastes effort.

**How to apply:** when he raises an infra topic, frame it as principles /
boundaries / mechanisms; defer concrete schemas and field-level detail to build
time unless he asks for them. Match his pragmatic altitude — add complexity only
when warranted. Observed while designing the site's persistence layer: he wanted
the seam / versioning / fail-soft / isolation principles, and got "we're getting
ahead of ourselves focussing on the specific what; this is about general
principles" when the concrete document schema came too early. Pairs with
[[feedback_work_from_the_back]].
