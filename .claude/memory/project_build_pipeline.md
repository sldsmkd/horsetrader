---
name: project_build_pipeline
description: A full cross-language build pipeline (seed skeleton → bake → gen:types → build → deploy) is BUILT as the root `Makefile` (2026-06-01). package*.json stays in horsetrader.site/ (not moved to root). index.html is build-generated (not a skeleton asset); skeleton holds only the non-generated remainder.
metadata: 
  node_type: memory
  type: project
  originSessionId: d03f9c59-e8bb-4d73-8651-868e3c257a88
---

**BUILT 2026-06-01 as the root `Makefile`** (neutral root runner — the chosen
shape; npm-workspaces option rejected). Targets: `seed` `bake` `types` `build`
`deploy` `clean`, all run from repo root. **`deploy` is intentionally STUBBED**
(prints a notice, wrangler line commented out) — a working prototype is live and
must not be clobbered; don't "fix" this by re-enabling wrangler. `clean` is the
only teardown; `seed` overlays (rsync), never wipes. Default `make` sequences seed→bake→
types→build via recursive `$(MAKE)` (order-safe under `-j`); each stage is also
independently runnable (so `make build` re-bundles the site without re-running
the expensive image bake). `make deploy` = full pipeline + wrangler publish.
Node stages invoked via `npm --prefix horsetrader.site run …`. The ordered,
polyglot shape:

0. **Seed** — copy the hand-authored `skeleton/` (root, tracked) → `static/` (the
   shell base: `favicon.ico`, hand-drawn/aseprite icons, other non-generated assets).
1. `venv/bin/python main.py` — ETL bake → `static/json/` (data) + `static/img/`
   (webp); JSON schema → `config/schema/`.
2. `npm run gen:types` — reads the schema (`config/schema/`) → `core/bundle/*.gen.ts`
   (the bridge; schema + contract defined in `docs/contract.md`).
3. `npm run build` — esbuild → `static/js/app.js` (+ `index.html` if the frontend
   session decides it's build-generated rather than a skeleton asset).
4. `wrangler deploy` — ship `static/`.

Step 0 is orchestration; stage 1 is Python; stages 2–4 are Node (owned by
`horsetrader.site/`).

**Deploy layout (built 2026-06-01):** the shippable artifact is the repo-root
`static/` (gitignored) — the **full deploy root** wrangler ships: JSON under
`static/json/` (`academy.json`/`events.json`), webp under `static/img/`, and the
site shell (`index.html`/`js`). **The ETL now bakes directly into `static/`** via
`Config().static` (= `_repo_root/"static"`), writing `static/json/` and
`static/img/<category>/`. (`generated/` was removed entirely 2026-06-01 — it had
become a vestigial one-file dir; there's no cross-side handoff file now, just the
single-purpose-session discipline.) The JSON **schema**
is *not* shippable — it lives in `config/schema/` (out of the deploy dir; it's the
contract the site's `gen:types` reads), **committed** (not gitignored) since it
only changes when the `msgspec` DTOs change. ⚠️ **Now-vestigial:** `HORSETRADER_TARGET` /
`Config._target()` lost their only consumer (the old `.site` property) in this move
and are **dead code** — retire when convenient (touches the `.env` skeleton +
dotenv-load logic, which still serves `HORSETRADER_SKIP_CACHE_REFRESH`).

**Skeleton base layer (established 2026-06-01):** the *tracked* root `skeleton/`
is the hand-authored base of the deploy artifact — only the **non-generated
remainder** no generator owns (favicon, fallback/example icons, Cloudflare
`_headers`/`_redirects`, robots.txt). It sits beside `static/` at the root so
source correlates 1:1 with output. `make seed` = `rsync -a --exclude=README.md
skeleton/ static/` (overlay, not wipe) before bake + build layer on top.
**RESOLVED: `index.html` is build-generated** (lives in `horsetrader.site/`,
esbuild `build` copies it into `static/`) — NOT a skeleton asset; matches
`docs/frontend/architecture.md`. **No real skeleton assets committed yet**
(decision: dir + documented convention, defer assets till the UI needs them);
`skeleton/README.md` documents the stage and is excluded from the seed.

**Decision (2026-06-01): `package*.json` stays in `horsetrader.site/`.** It was
considered for a move to the repo root; rejected. The frontend is a
self-contained JS sub-project (its `package.json`, `scripts/gen-types.mjs`, build
config, paths); the root is the Python world. The build pipeline did **not**
relocate the frontend manifest up — it added a **root orchestration layer** (the
`Makefile`) on top. **Don't re-litigate moving `package.json` to root.** The
chosen shape was the **neutral root runner (Makefile)** over npm-workspaces,
since Python is stage 1 and deploy is wrangler (npm-as-root would awkwardly wrap
Python).

Related: [[project_site_consumer_workspace]], [[project-workspace-split]].
