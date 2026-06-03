---
name: feedback_curated_keys_copy_a_neighbour
description: "For rarely-edited curated YAML, make keys self-evident/load-bearing so an editor copies a neighbour instead of consulting docs/code."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 25aef9ac-f957-4a1d-bfa7-c3490ee81d53
---

For hand-curated static files that get edited only a few times a year (e.g.
`config/anchored.yaml`, edited ~once every 4 months), optimise for copy-a-neighbour
discoverability: encode load-bearing meaning into self-evident **key prefixes**
plus a copyable example block, rather than a separate structural field that sends
the editor to the docs or loader to learn a convention.

Concrete case: anchored events carry their before/after direction in the key
prefix (`before-` / `after-`, with `during-` a synonym for `after-`), not a
`relation:` field — even though I initially recommended an explicit field on
"structure over comments" grounds.

**Why:** the editor's whole workflow is "open the file, find a similar entry,
copy it, tweak it." A prefix you can pattern-match beats correctness machinery
that's only legible after reading code. Edit frequency is the deciding factor.

**How to apply:** when proposing the shape of a hand-curated file, weigh how
often it's touched. Rare edits → favour self-documenting keys + a header that
says "copy a block below." Don't reflexively push an explicit field; offer it,
but accept prefix/structural conventions when copy-paste ergonomics win. Still
fail loud on an unrecognised prefix. Refines [[feedback_yaml_structure_over_comments]];
see also [[feedback_curated_yaml_fails_loud]].
