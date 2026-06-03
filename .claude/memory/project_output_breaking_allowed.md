---
name: project_output_breaking_allowed
description: "As of 2026-05-30, free to break serialized output structures; downstream prototype is being rebuilt"
metadata: 
  node_type: memory
  type: project
  originSessionId: ff34028a-2b93-4fb6-9d23-c07320ac586a
---

As of 2026-05-30 the constraint to preserve the serialized output data structures (so the downstream prototype doesn't break) is **lifted**. We may freely change the shape of what the ETL serialises (e.g. `bake.py` output) without caring about breaking the current downstream prototype.

**Why:** The downstream prototype existed only to discover the UX and is pending a full rebuild once the data here is finalised. Keeping output stable for a throwaway prototype was holding back the data model.

**How to apply:** Optimise the output structures for correctness/clarity, not back-compat, until told otherwise. The constraint **returns** once the front-end rebuild is done and in production — at that point treat the wire format as stable again. Related: the wire contract (docs/contract.md).
