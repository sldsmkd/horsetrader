---
name: feedback-git-workflow-phase
description: "Frontend view layer now uses branch-per-feature (the end-to-end loop is proven). ETL/other rapid work still commits straight to main with no ceremony."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93535408-1a74-4f43-b0b7-917f27b9dbd8
---

The workflow split by **2026-06-03**: the trigger that flips main-YOLO → branches turned out to be **reaching a stable end-to-end path**, not getting a real client. The frontend view layer now has a proven one-way loop (interaction.md steps 1–3), so **frontend feature work goes on a branch per feature** (e.g. `4a-xfordate`; see the 4a–4f decomposition in interaction.md). Still-churning work without an end-to-end path (ETL, exploratory) **keeps committing straight to `main` with no ceremony**.

**Why:** branches earn their keep once there's a working baseline a feature can be measured against and could regress; before that they were pure overhead. The user named this explicitly when the timeline-substrate work began.

**How to apply:**
- **Frontend `ui/` features:** cut a short-named branch (`4a-xfordate`-style) per feature; merge to `main` when green. Commit messages stay lightweight — no elaborate multi-paragraph ceremony.
- **ETL / pre-baseline work:** still fine to commit straight to `main` simply; don't push branches on it.
- When unsure which side a change is on, the test is "does a proven end-to-end path exist here that this could break?" — if yes, branch.
- Verifying the commit captured everything and builds is always welcome.
