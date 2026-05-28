# Agent entrypoint

If you're an agent (Claude Code, Codex, etc.) or a new human reader:
**start with [`docs/README.md`](docs/README.md)**.

The full documentation set lives in [`docs/`](docs/) and is the single
source of truth for how this ETL works. Quick links:

- [`docs/onboarding.md`](docs/onboarding.md) — setup, env vars, first
  run.
- [`docs/architecture.md`](docs/architecture.md) — pipeline stages and
  what runs in what order.
- [`docs/semantics.md`](docs/semantics.md) — the character-named
  module convention (`@digitan`, `@shakur`, …).
- [`docs/standards.md`](docs/standards.md) — code conventions before
  your first change.
- [`docs/data-sources.md`](docs/data-sources.md) — what's scraped vs.
  hand-curated.
- [`docs/prediction.md`](docs/prediction.md) — how EN dates get
  filled in.
- [`docs/domain.md`](docs/domain.md) — game-side rules the ETL depends
  on.

This file is intentionally short. When something in the docs is wrong,
fix the doc — don't add corrections here.
