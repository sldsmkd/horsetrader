def yayoi(cls):
    """Yayoi — the patron who hands out resources.

    Akikawa Yayoi is the director of Tracen Academy, known for her
    generous out-of-pocket support of the students. Her module owns
    *rewards* — what an event gives away while it runs: the per-currency
    counters (carats, scout tickets, gold shards, …) and any
    sequence-shaped handouts (daily login streaks and similar) attached
    to an event.

    Distinct from Digitan (who knows *what an entity is*) and Daitaku
    (who knows *when an event happens*): Yayoi knows *what an event
    gives out*. The values themselves are primitives — Yayoi-owned code
    doesn't carry ``TracenModel`` scaffolding; it's plain data attached
    to events.

    Character bio: see ``yayoi.md`` alongside this file.
    """
    return cls
