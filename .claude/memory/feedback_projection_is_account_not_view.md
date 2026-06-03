---
name: feedback_projection_is_account_not_view
description: core/projection is account/domain state only; view-presentation settings (axis scale, theme) belong in ui/, never in projection or the plan
metadata:
  type: feedback
---

`core/projection` is strictly **what's in your account** — snapshot, income model,
commitments → ledger/balance. Anything about **how you're looking at it** (the
timeline px-per-day scale / `xForDate`, zoom, a future dark/light mode or font
size) is a **presentation/view setting**, not domain state, and lives in `ui/` —
never in projection.

**Why:** the user's test for "does this go in projection?" is "is it a fact about
my account?" The axis scale fails that test the same way a theme toggle would; it
is the same *class* of thing as dark mode.

**How to apply:** put the pure axis-mapping function in `ui/` primitives (beside
`h()`/`format.ts`); its state splits on the existing tiers — pan offset =
transient interaction-state (cheap path), zoom/scale = discrete view-state store
([[project_ui_design_doc]]). A *persisted* preference (theme) is a third bucket:
durable across sessions but still NOT in the plan document (persistence.md). See
[[project_workspace_split]] for the coarser backend↔frontend boundary; this is the
finer core↔ui one.
