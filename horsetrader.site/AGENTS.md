# Agent entrypoint

If you're an agent (Claude Code, Codex, etc.) or a new human reader:
**start with [`docs/README.md`](docs/README.md)**.

This is the **site** repo — the web planner (raw-DOM TypeScript, no framework)
that consumes the static bundle baked by the sibling **etl** repo. The full
design lives in [`docs/`](docs/) and is the single source of truth for the
foundation. Quick links:

- [`docs/architecture.md`](docs/architecture.md) — the keystone: the
  static/zero-server driver, the two core pillars, and how data flows.
- [`docs/persistence.md`](docs/persistence.md) — pillar 1: storing the user's
  inputs.
- [`docs/projection.md`](docs/projection.md) — pillar 2: the ledger engine that
  derives everything else.
- [`docs/conventions.md`](docs/conventions.md) — language, layering, and the
  raw-DOM patterns before your first change.
- [`docs/trust-and-failure.md`](docs/trust-and-failure.md) — what we trust, what
  we validate, and how things fail.

The ETL is a separate repo with its own workspace and its own
[`AGENTS.md`](../etl/AGENTS.md); **don't edit it from here.** The shared
`generated/` folder is the bridge — cross-repo asks go in
[`../generated/TODO.md`](../generated/TODO.md).

This file is intentionally short. When something in the docs is wrong, fix the
doc — don't add corrections here.
