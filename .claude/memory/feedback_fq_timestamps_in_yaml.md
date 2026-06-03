---
name: feedback-fq-timestamps-in-yaml
description: "Curated static YAML should carry fully-qualified ISO timestamps (date + time + offset). Don't hide drop-time conventions behind loader constants like `_NEW_YEAR_HOUR = 5`."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

When a curated `config/*.yaml` field represents an instant in time, store the **fully-qualified ISO timestamp** in the YAML — `2022-01-01T05:00:00+09:00`, not a `start: 2022-01-01` paired with a `_drop_hour()` lookup in the loader. Document the drop-time conventions in a header comment in the YAML itself.

**Why:** The data IS the source of truth. Hidden hour constants in the loader (`_NEW_YEAR_HOUR = 5`, `_GOLDEN_WEEK_HOUR = 12`, `_EN_HOUR_UTC = 22`) split a single fact across two files and make it impossible to audit or override a single entry's drop time without code changes. Confirmed by the user during the 2026-05-29 holidays merge after I proposed the FQ shape and they replied "that's the correct place for it."

**How to apply:** Any future static dataset with timestamp fields (the planned `anniversaries.yaml` and `scenarios.yaml` merges, future `countdown:` blocks, etc.) follows the same rule:

- YAML: `start: 2022-01-01T05:00:00+09:00` (date + time + offset).
- Loader: validate `isinstance(value, datetime) and value.tzinfo is not None`; never assume a tz, never strip and rewrap with a hardcoded hour.
- YAML header comment: spell out the drop-time conventions for the editor's reference.
- Related: [[project-static-yaml-region-namespace]] (the parent shape).

YAML 1.1 timestamps parse via `yaml.safe_load` to `datetime` whose `tzinfo` compares equal to `horsetrader.core.JST` / `UTC` — so predictors doing `p.tzinfo == JST` keep working without conversion.
