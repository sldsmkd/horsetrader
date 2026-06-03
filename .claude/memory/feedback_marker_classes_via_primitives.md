---
name: feedback-marker-classes-via-primitives
description: "User defaults to marker classes that inherit from primitives (int/str/...) \"for behaviour for free\"; offer composition (dataclass with a typed field) as the alternative."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 47a056d2-e490-48b1-8467-55444e202a1e
---

When designing a typed value hierarchy, the user instinctively reaches for marker-class-via-primitive-inheritance (e.g. `class Carats(Reward, int): pass`) because it gives arithmetic/coercion behaviour without extra code. Offer the composition shape (a frozen dataclass holding the value: `class Carats(Reward): amount: int`) when the multi-inheritance brings real cost.

**Why:** During the docs/domain.md (Rewards) design pass, the user prototyped `class SimpleReward(Reward, int): pass` and then said "I dont like the multi inheritance"; after I suggested composition, they accepted and said "I just naturally reach for marker classes and get the behaviour for free" — confirming this is a recurring instinct, not a one-off. MI on `int`/`str` forces `__new__` for any future init logic, blocks adding instance attrs cleanly (immutable parent), and semantically conflates "is a Reward" with "is a number."

**How to apply:** When the user introduces or sketches a typed-value hierarchy where a subclass inherits from a primitive *plus* a marker base, flag the composition alternative explicitly with the tradeoff (one extra dereference at call sites: `c.amount` rather than `int(c)`). Don't push it if the type genuinely needs to *be* the primitive (e.g. participates in arithmetic, JSON-serialises directly). Push it when the type is conceptually a wrapper that *holds* a value of that primitive type — that's the case where MI just papers over composition with extra surface.
