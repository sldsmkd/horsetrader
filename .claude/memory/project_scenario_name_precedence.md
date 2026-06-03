---
name: project-scenario-name-precedence
description: "Software-wise `en.name` is just the EN string (preferred over `jp.name` for display); fansub-vs-official is a data-quality concern, not modelled in code. Don't build a fansub/official distinction into loaders."
metadata: 
  node_type: memory
  type: project
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

In merged `config/scenarios.yaml` ([[project-static-yaml-region-namespace]]), each entry has `jp.name` (JP title) and `en.name` (EN title). The loader emits `title_jp` + `title_en`; the `Scenarios` model builds a `Japlish` from the JP name and sets `.en` to en.name, so **`en.name` wins for display**.

**The point (user, 2026-05-30): from a software perspective we don't care about fansub vs official — it's just data quality.** `en.name` is one normalised EN-name field; the maintainer overwrites it in place with the official wording when a scenario reaches Global, but no loader/model distinguishes the stages. Don't build a fansub/official distinction into code, and don't over-document the lifecycle in code-facing docs. `en.start` presence is the only "shipped" signal the software reads.

The one genuine **cross-source override** lives in **stories**: `stories.yaml`'s `en.name` overrides the *live Gametora-scraped* title at extraction — a real mechanism (curation beats scrape), unlike scenarios where it's just a curated string.

**How to apply:** porting `anniversaries.yaml` — treat `en.name` as a single EN-name string; `en.start` is the shipped flag. No "official" field, no lifecycle logic.
