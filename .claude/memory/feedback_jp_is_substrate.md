---
name: feedback_jp_is_substrate
description: JP is the substrate; EN is projected from it. Never build from the EN YAML — that inverts the model.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 03d49c67-59e3-43d8-b90b-de080e7f87b9
---

The ETL's whole premise: take the *known* JP-server state and project the EN
(Global) schedule from it via correlations. Direction of derivation is fixed and
one-way: **JP (scraped, known) → EN (predicted, then confirmed by curated YAML).**
Every event's existence, identity, and stable key come from JP — no JP period
means the event does not exist in this system. The curated EN `config/yaml/*.yaml`
overlay only *confirms/refines* the projection for events JP already gave us; it
is never a source of existence.

**Why:** the user watched a Sonnet agent get lost building a new extractor — it
found the tidy EN YAML and started treating it as the dataset (keying off it,
wondering why JP "didn't fit"), inverting the model. The EN file is seductive
precisely because it's clean and present.

**How to apply:** when wiring/extending any event type, build the JP source
first (it's non-optional) and treat the EN YAML as an optional curator-owned tail
— see the wire contract (docs/contract.md) and the build recipe in
`docs/howto-new-extractor.md` (it leads with this as its "first principle"). If
you ever catch yourself starting from the EN YAML, stop and go back to the JP
scrape. The YAML is the tail; JP is the dog. Related: [[project_prediction_complete]].
