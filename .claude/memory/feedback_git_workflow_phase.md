---
name: feedback-git-workflow-phase
description: "During rapid pre-client iteration, commit straight to main with no branch/commit ceremony. Don't proactively offer feature branches or elaborate commit messages yet."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93535408-1a74-4f43-b0b7-917f27b9dbd8
---

The codebase is under **rapid iteration with no real client yet**, so git formalities are unwanted at this stage. The user commits straight to `main` (e.g. `git commit -m YOLO`) and is fine with that.

**Why:** branches + careful commit messages are overhead during exploration; they slow the loop without payoff while there's no client and the surface is still churning. The user will switch to **lightweight feature branches once the codebase is stable and there's an actual client** — not before.

**How to apply:**
- Don't proactively offer to branch off `main` or propose elaborate multi-paragraph commit messages.
- When the user says "commit" / "lock this down" in this phase, just stage and commit to `main` simply (or note they can) — skip the branch-first dance.
- Verifying the commit captured everything and builds is still welcome; the ceremony around *how* to commit is not.
- Revisit when the user signals the project is stabilising / has users.
