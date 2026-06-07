# `skeleton/` — the hand-authored static shell

This is **stage 0** of the build pipeline (see the root `Makefile`). Its contents
are copied verbatim into the deploy root `static/` *before* the ETL bake and the
site build overlay their generated output on top:

```
skeleton/  ──seed──▶  static/  ◀──bake── ETL (generated json/, img/)
                              ◀──build── site (index.html, js/)
```

So `skeleton/` holds only the parts of the deploy root that **no generator
owns** — the hand-authored shell. Most `static/json/` files are ETL generated,
but hand-authored UI copy such as `json/strings.json` lives here and is seeded
before the ETL overlays its generated bundles. The ETL owns `static/img/` and
generated data JSON; the site build owns `static/index.html` + `static/js/`.
Anything else that must ship lives here.

## What belongs here

- **Example / fallback icons** — the placeholder image the UI shows when an
  entity's baked webp is missing.
- **Hand-authored UI strings** — for example `json/strings.json`, which the
  frontend loads before falling back to its typed defaults.
- **`favicon.ico`** / app icons.
- **Cloudflare Pages config** that ships in the web root — `_headers`,
  `_redirects`.
- **`robots.txt`** and similar static, hand-maintained files.

Keep these to a minimum: if a generator *could* own an asset, it should. This
stage exists for the irreducible hand-authored remainder.

## Notes

- This `README.md` documents the stage and is **excluded from the seed** — it
  never lands in `static/`.
- The seed is `rsync -a --exclude=README.md skeleton/ static/` (overlay, not
  wipe). `make clean` wipes `static/`; a fresh `make` re-seeds it.
- No real assets are committed yet — they land when the UI needs them. This file
  keeps the stage tracked and documents the convention in the meantime.
