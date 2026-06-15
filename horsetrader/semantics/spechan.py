def spechan(cls):
    """Spechan — observability (cross-cutting).

    Special Week's frequent purchase is letter sets — she's always
    writing detailed updates home to her moms — and she also likes
    "detailed food reports." Her module owns observability across the
    pipeline, in two registers:

    - **Logging** (``Logger``): the qualitative narration — structured
      records of *what happened*, dispatched somewhere to be read later.
      She owns formatting/levels/sinks.
    - **Metrics** (``Metrics``): the quantitative log — *how much / how
      many / how long*. A single store every character writes counters
      and timings into and reads back, so a run's numbers live in one
      place rather than scattered across classvars and instance dicts.

    Both are the same instinct (a detailed report home), just words vs.
    numbers. If code is "tell someone what just happened / how much" —
    without affecting the pipeline output itself — it's Spechan's.

    Character bio: see ``spechan.md`` alongside this file.
    """
    return cls
