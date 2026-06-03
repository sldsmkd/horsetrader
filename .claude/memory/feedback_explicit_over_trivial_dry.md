---
name: feedback_explicit_over_trivial_dry
description: "Trivial one-line guards stay inline & duplicated; don't extract a tiny shared predicate even at N=3 (house style = explicit)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b6ef4a3-9af8-4ba4-8003-f0279fedd1b5
---

A trivial single-expression guard duplicated across files stays **inline and
duplicated** — house style is explicit. Concrete case: the strict-after filter
`if (date <= after) continue;` repeated in the three projection stream producers
(events / generator / sequence). I offered to extract a shared `emittedAfter`
predicate; the user declined — "house style says explicit."

**Why:** a one-liner reads clearer inline than behind a named helper; the DRY win
is negligible and the indirection costs legibility (you'd jump to the helper to
learn it's just `date > after`).

**How to apply:** don't offer or extract a shared predicate for a trivial
one-expression guard, even at N=3. Reserve extraction for duplication with real
substance. Refines [[feedback_work_from_the_back]] (smallest primitive that
removes *literal* duplication) with a floor: the duplicated unit must be more than
a trivial expression to be worth lifting.
