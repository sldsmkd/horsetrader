# Onboarding

How to get the horsetrader ETL running on a clean machine, and a map of what
sits where in the repo once it is.

## Prerequisites

- **Python 3.14** (pinned via `.python-version`). Earlier 3.x will probably
  work but isn't tested.
- **git**.
- A Chromium / Chrome binary on the system path. Some Gametora pages are
  JS-rendered and need a headless browser via Selenium.

## Setup

```bash
git clone <repo-url> horsetrader-etl
cd horsetrader-etl

python3.14 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

The pinned set in [`requirements.txt`](../../requirements.txt) is a `pip freeze`
snapshot. Direct dependencies: `ethicrawl`, `selenium`, `lxml`, `requests`,
`Pillow`, `PyYAML`, `numpy`, `python-dotenv`. Refresh the freeze when you
deliberately bump anything.

## Configuration

All runtime config goes through [`horsetrader.core.Config`](../../horsetrader/core/config.py)
— do **not** read `os.environ` from library code. The only required variable
is the output root:

```bash
# .env at the repo root
HORSETRADER_TARGET=/absolute/path/to/horsetrader/generated
```

On first instantiation `Config` walks up from CWD looking for `.env`; if it
finds neither a file nor `HORSETRADER_TARGET` in the shell, it writes a
skeleton `.env` to CWD and exits with a message asking you to fill it in.

`HORSETRADER_TARGET` points at the **shared handoff directory**
(`/home/$USER/code/horsetrader/generated` on the author's machine). The ETL
writes `<target>/site/…`; the web repo reads from the same path. Don't
nest it inside the ETL repo.

### Optional flags

| Var | Effect |
| --- | --- |
| `HORSETRADER_SKIP_CACHE_REFRESH` | Truthy → skip cache TTL checks. Re-read on every access, so flipping mid-run takes effect. Use when you want a fully offline run against the existing cache. |

## Running the pipeline

```bash
python main.py
```

That's the whole thing. `main.py` constructs `Pipeline()` (singleton),
calls `.run()` once, then prints metrics as JSON. `Pipeline.run()` is
one-shot: a second call logs an error and bails — see
[architecture.md](architecture.md) for why.

Output lands under `$HORSETRADER_TARGET/site/`. Cache lives at the repo
root `.cache/` (resolved from the repo root, not `HORSETRADER_TARGET`).

## First run + jitter

A cold run hits Gametora / Umapyoi / sundry hand wikis for every entity in
the corpus. **Expect it to take a while** — `ethicrawl` rate-limits
respectfully and that's deliberate.

After the first run, run [`jitter.py`](../../jitter.py) **once**:

```bash
python jitter.py
```

It rewrites cache-file mtimes to land randomly inside the last 30 days, so
the next refresh doesn't try to re-fetch every URL on the same day.
Without jitter your monthly refresh would stampede the upstreams in a
single session. Run it any time you've done a bulk warm-up.

The N+1 first-fetch loop in extractors is **not a bug** — it's the
consequence of eager, scraper-context-respecting loading. Don't "fix" it
without reading [architecture.md](architecture.md) first.

## Repo layout

```
horsetrader-etl/
├── main.py                  # entry point — Pipeline().run()
├── jitter.py                # post-warmup mtime jitter (run once after cold fetch)
├── config/                  # yaml/ (auto-loaded curated corpus), img/ (story banners), pending/ (not-yet-wired)
├── references/              # human-eye reference only — announcements/ (monthly images), apologems/
├── docs/                    # this folder
└── horsetrader/             # the package
    ├── core/                # config, period, japlish, singletons (zero-dep primitives)
    ├── transport/           # UmaClient + cache — the wire layer (Shakur's territory)
    ├── extractors/          # Gametora / Umapyoi / static-YAML scrapers (Transcend)
    ├── models/              # entities (characters, supports, trainees) + events (banners, scenarios)
    ├── timeline/            # Predict + Timeline + per-event-type Predictors
    ├── output/              # Bake — final JSON serialisation (Eishin)
    ├── pipeline/            # Pipeline orchestrator (Rudolf)
    ├── semantics/           # character decorators + their role docstrings + bio .md files
    └── info/                # logger
```

Two namespaces coexist on purpose: conventional ones (`models/`,
`extractors/`, `timeline/`, …) describe **what kind of code lives there**,
and character decorators (`@digitan`, `@shakur`, …) mark **which role owns
each piece**. [semantics.md](semantics.md) explains why.

## Where to next

- [architecture.md](architecture.md) — what runs in what order, and which
  collection feeds which.
- [standards.md](standards.md) — code conventions before your first PR.
