---
name: reuse-dev-server
description: "Don't stop/start the dev server for browser verification — check port 3000, ask once if down, reuse it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a7ba06dd-1169-4b0a-8f93-e2cbc73359af
---

For in-browser verification, do **not** spin up/tear down a server yourself each
time (the old habit of an ad-hoc `python3 -m http.server` + launching chromium,
then killing them). Instead: check whether the dev server is already up on
**localhost:3000**; if it isn't, **ask the user once** to start it (`npm run dev`
/ `make dev`, which serves the repo-root `static/`) and then **reuse that one
server for the rest of the session**. Drive headless chromium via CDP against
:3000 when a screenshot is needed.

**Why:** avoids the constant back-and-forth of stopping and starting the server
every verification; the user would rather own the long-running server in a
terminal and have me reuse it.

**How to apply:** first time a session needs the running app, probe :3000; if
down, ask the user to start it and continue once it's up — don't manage the
server lifecycle myself. Pairs with [[feedback_use_real_cache_for_verification]]
(reuse the warm cache, don't blow it away) — same "reuse the standing thing"
instinct. Note `npm run dev` has no auto browser-reload: a fresh bake or source
change is picked up on **refresh**, and deploy (wrangler) stays stubbed.
