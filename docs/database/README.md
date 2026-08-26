# Client database

This folder documents the databases shipped by the official Umamusume clients.
It is our route away from treating Gametora's presentation model as the source
schema. The client is authoritative for game identifiers, mechanics values, and
the localized text actually distributed in that client; it does not by itself
define Horsetrader's public model.

## Current source

The first snapshot is the installed Steam Global client (`3224770`).
[`SteamFile`](../../horsetrader/transport/steam_file.py) copies live files into
`.cache/databases/global/` before readers open them. The checked-in docs contain
schema and aggregate facts only—never the proprietary database files.

| File | Shape | Current use |
| --- | --- | --- |
| `master/master.mdb` | Ordinary SQLite | Tables, game data, and Global localized text |
| `meta` | ChaCha20-encrypted SQLite | Asset catalogue; transported but not needed for skills |

JP (`3564400`) has its own configured cache namespace, but there is no synced JP
database on this machine. Do not assume that Global and JP snapshots have
identical tables or populated rows; compare them when a legitimate JP client
database becomes available.

## Documents

- [`catalog.md`](catalog.md) — generated inventory of every table, row count,
  column count, primary key, and index count in one exact Global snapshot.
- [`identifiers.md`](identifiers.md) — character, trainee-card, variant, and
  rarity identifiers, including the exceptions that make decimal parsing unsafe.
- [`skills.md`](skills.md) — the first semantic map: skill definitions, localized
  text, set membership, and the relationships proven by the extractor spike.

## Evidence levels

Database notes use three levels deliberately:

- **Physical** — SQLite metadata or a value stored directly in a column.
- **Observed relationship** — a join checked against the identified snapshot,
  with its coverage recorded.
- **Interpretation** — a likely meaning inferred from names or values. It remains
  provisional until client behavior or another authoritative source confirms it.

This matters because `master.mdb` declares no foreign keys. Similar names are
useful leads, not contracts: for example, `support_card_data.skill_set_id` does
not join to `skill_set.id`; it identifies a support hint set through
`single_mode_hint_gain.hint_id` instead.

## Regenerating the catalog

Refresh the transport cache, then run:

```sh
venv/bin/python scripts/document_client_database.py
```

The generator opens the database read-only, runs `PRAGMA quick_check`, and
records its MD5. Review the catalog diff before updating semantic pages: a new
table or row does not automatically establish what it means.
