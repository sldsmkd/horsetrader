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
PYTHON ?= venv/bin/python

.PHONY: all seed bake types build dev serve deploy clean

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

# Wipe the regenerated deploy root (skeleton seed + bake + build output).
clean:
	rm -rf $(STATIC)
