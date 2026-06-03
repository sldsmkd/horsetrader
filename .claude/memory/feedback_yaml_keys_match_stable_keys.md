---
name: feedback-yaml-keys-match-stable-keys
description: "Keys in curated `config/*.yaml` must be identical to the downstream stable key. No upstream-format keys, no zero-pad-on-load normalization."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

A curated YAML key **must be byte-for-byte identical** to the stable key it refers to downstream. No upstream-vendor formats (Gametora's unpadded `story-1`), no normalization step in the loader (`f"story-{n:03d}"`).

**Why:** Said by the user on 2026-05-29 during the stories migration: *"fix it, yaml should always match stable key."* The old `stories.yaml` used Gametora-style `story-1` while stable keys were `story-001`; the loader bridged them via regex. That divergence is a footgun — grepping `story-011` in logs/baked output didn't find it in `stories.yaml`, and any cross-referencing between yaml and code required mental translation. Padding is already required on stable keys for search-collision reasons (see docs/domain.md (Story Events)); the YAML matching just keeps the convention end-to-end.

**How to apply:**

- New / migrated `config/*.yaml`: every top-level key is a stable key, exact match. If the stable key is zero-padded, the YAML key is zero-padded too.
- Loader: validate the key against the stable-key regex and use `str(key)` directly. Don't extract an integer and reformat — that's the normalization step that hides the divergence.
- This applies to the queued anniversaries / scenarios merges; pick the stable-key form before writing the YAML, not the upstream-source form.
- Where vendor IDs are still useful (e.g. Gametora's integer for cross-correlation), they belong in the model's `correlations` field, not in the YAML key. See docs/domain.md (Story Events).
- Related: [[project-static-yaml-region-namespace]] (overall YAML shape); [[feedback-yaml-structure-over-comments]] (general "let structure enforce contracts" principle).
