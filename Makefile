# Horsetrader build pipeline.
#
# The shippable web root is `static/` (gitignored, regenerated). It is assembled
# by overlaying three stages in order, each writing a disjoint part of the tree:
#
#   0. seed    skeleton/  — hand-authored shell (favicon, fallback icons, ...) -> static/
#   1. bake    ETL        — JSON bundle + webp images                          -> static/json/, static/img/
#                           (+ JSON Schema, the etl<->site contract            -> config/schema/)
#   2. build   site       — index.html + bundled js/css                        -> static/, static/js/
#
# `types` sits between bake and build: it compiles config/schema/ into the
# site's committed TypeScript bundle types so the build can typecheck.
#
# `make` runs the whole pipeline (seed -> bake -> types -> build) in order;
# `make deploy` does that then publishes. The stages are also runnable on their
# own (e.g. `make build` to re-bundle the site without re-running the expensive
# image bake). For tight site iteration use `npm --prefix horsetrader.site run dev`
# after a one-off `make seed bake`.

SITE   := horsetrader.site
STATIC := static
REPORTS := reports

# Cloud services live one-per-dir under horsetrader.cloud/{service}, each a
# self-contained npm project (own package.json, lockfile, pinned deps, wrangler
# + eslint config). The security stage discovers them here and runs each one's
# `security:audit` + `security:sast` scripts — so a new service is covered the
# moment it adopts the per-service template (see horsetrader.cloud/README.md).
CLOUD_SERVICES := $(wildcard horsetrader.cloud/*/)
PYTHON ?= venv/bin/python
PYTHON_REPORT ?= python
ANNIVERSARY_FLAGS ?=

.PHONY: all seed bake types build dev serve deploy deploy-nobake deploy-cloud security security-deps security-sast security-secrets security-report report-anniversary-economy report-anniversary-plot report-anniversary-equivalent-economy report-anniversary-equivalent-plot report-anniversary-equivalent report-anniversary reports clean

# Full pipeline, sequenced (recursive $(MAKE) keeps order even under `make -j`).
all:
	$(MAKE) seed
	$(MAKE) bake
	$(MAKE) types
	$(MAKE) build

# Stage 0 — seed the deploy root from the hand-authored shell. README.md is the
# stage's own doc, and aseprite/ holds editable source art; neither is a deploy
# asset, so they never cross into static/.
seed:
	mkdir -p $(STATIC)
	rm -rf $(STATIC)/aseprite
	rsync -a --exclude=README.md --exclude=aseprite/ skeleton/ $(STATIC)/

# Stage 1 — ETL bake: JSON + images into static/, schema into config/schema/.
bake:
	$(PYTHON) main.py

# Between 1 and 2 — derive the site's bundle types from the published schema.
types:
	npm --prefix $(SITE) run gen:types

# Stage 2 — site build: index.html + bundled js/css into static/.
build:
	npm --prefix $(SITE) run build

# Local dev server — esbuild live-rebuilds js/css while serving the assembled
# static/ root at http://localhost:3000. The data (json/, img/) is served from
# static/ as-is, so run `make` (or at least `make seed bake`) once first if it's
# empty. `serve` is an alias. Blocks until you ^C.
dev serve:
	npm --prefix $(SITE) run dev

# Security stage (Unity). The trust-model flip — first server, first secrets,
# first external deps (unity/design.md §2) — earns the project's first security
# gate. Three legs, scoped to the new public boundary (NOT the local Python ETL):
#   deps    — npm audit on RUNTIME/shipped deps (--omit=dev). Today the site has
#             no runtime deps (0 vulns); the future Worker's vetted deps land
#             here. Dev-toolchain noise (wrangler/miniflare) is advisory only via
#             `make security-report`, never a deploy gate.
#   sast    — eslint-plugin-security over the Worker surface (untrusted ingress).
#   secrets — gitleaks over the whole tree (a leaked secret harms in any file).
# Gates `deploy` and `deploy-nobake` so nothing ships without passing.
security: security-secrets security-deps security-sast

# deps — supply-chain audit of every npm-built artifact we publish: the site
# bundle (shipped to users via Pages) + each cloud service (runs on Workers).
security-deps:
	npm --prefix $(SITE) run security:audit
	@for svc in $(CLOUD_SERVICES); do \
	  echo "==> audit $$svc"; \
	  npm --prefix $$svc run security:audit || exit 1; \
	done

# sast — code-smell scan of the untrusted-ingress surface = the cloud services
# ONLY (design.md §2: harden the new public boundary, don't retrofit the site or
# the Python ETL). Empty until the first service lands.
security-sast:
	@for svc in $(CLOUD_SERVICES); do \
	  echo "==> sast $$svc"; \
	  npm --prefix $$svc run security:sast || exit 1; \
	done

security-secrets:
	@command -v gitleaks >/dev/null 2>&1 || { \
	  echo "ERROR: gitleaks not installed — required for the secret-scan leg."; \
	  echo "  install: https://github.com/gitleaks/gitleaks/releases"; \
	  echo "           (e.g. 'brew install gitleaks', 'yay -S gitleaks', or the static binary)"; \
	  exit 1; }
	gitleaks dir . --no-banner --redact

# Advisory only (never gates): full audit incl. the dev toolchain.
security-report:
	-npm --prefix $(SITE) audit

# Publish the assembled static/ root to Cloudflare Pages. Security-gated.
deploy: all
	$(MAKE) security
	npm --prefix $(SITE) run deploy

# Publish without re-baking: re-seed/type/build over the existing static/json/ +
# static/img/ and ship. For when the bake's data sources are down (e.g. umapyoi)
# and you only want to push site (js/css/html) changes. Requires a prior full
# `make` to have populated the baked data — don't `make clean` before this.
deploy-nobake: seed types build
	$(MAKE) security
	npm --prefix $(SITE) run deploy

# Publish the cloud Worker(s) — every service under horsetrader.cloud/{service}
# via its own `deploy` script (wrangler), so the folder + wrangler project name
# stay in each service's own config, never typed by hand. Security-gated like the
# site deploys. Run after editing a Worker (e.g. unity-sync auth/sync).
deploy-cloud:
	$(MAKE) security
	@for svc in $(CLOUD_SERVICES); do \
	  echo "==> deploy $$svc"; \
	  npm --prefix $$svc run deploy || exit 1; \
	done

# Local analysis reports. Outputs are intentionally gitignored.
reports:
	mkdir -p $(REPORTS)

report-anniversary-economy: reports
	npm run analyze:anniversaries:matrix -- $(ANNIVERSARY_FLAGS) --out $(REPORTS)/anniversary-raw-matrix.csv

report-anniversary-plot: reports
	$(PYTHON_REPORT) scripts/plot_anniversary_streams.py --csv $(REPORTS)/anniversary-raw-matrix.csv --resource free_carats --out $(REPORTS)/anniversary-streams-free-carats.png

report-anniversary: report-anniversary-economy report-anniversary-plot

report-anniversary-equivalent-economy: reports
	npm run analyze:anniversaries:matrix -- --carat-equivalents --out $(REPORTS)/anniversary-carat-equivalent-matrix.csv

report-anniversary-equivalent-plot: reports
	$(PYTHON_REPORT) scripts/plot_anniversary_streams.py --csv $(REPORTS)/anniversary-carat-equivalent-matrix.csv --resource carat_equivalent --out $(REPORTS)/anniversary-streams-carat-equivalent.png

report-anniversary-equivalent: report-anniversary-equivalent-economy report-anniversary-equivalent-plot

# Wipe the regenerated deploy root (skeleton seed + bake + build output).
clean:
	rm -rf $(STATIC)
