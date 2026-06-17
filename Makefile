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
PYTHON ?= venv/bin/python
PYTHON_REPORT ?= python
ANNIVERSARY_FLAGS ?=

.PHONY: all seed bake types build dev serve deploy deploy-nobake report-anniversary-economy report-anniversary-plot report-anniversary-equivalent-economy report-anniversary-equivalent-plot report-anniversary-equivalent report-anniversary reports clean

# Full pipeline, sequenced (recursive $(MAKE) keeps order even under `make -j`).
all:
	$(MAKE) seed
	$(MAKE) bake
	$(MAKE) types
	$(MAKE) build

# Stage 0 — seed the deploy root from the hand-authored shell. README.md is the
# stage's own doc, not a deploy asset, so it never crosses into static/.
seed:
	mkdir -p $(STATIC)
	rsync -a --exclude=README.md skeleton/ $(STATIC)/

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

# Publish the assembled static/ root to Cloudflare Pages.
deploy: all
	npm --prefix $(SITE) run deploy

# Publish without re-baking: re-seed/type/build over the existing static/json/ +
# static/img/ and ship. For when the bake's data sources are down (e.g. umapyoi)
# and you only want to push site (js/css/html) changes. Requires a prior full
# `make` to have populated the baked data — don't `make clean` before this.
deploy-nobake: seed types build
	npm --prefix $(SITE) run deploy

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
