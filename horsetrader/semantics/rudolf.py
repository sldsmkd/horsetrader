def rudolf(cls):
    """Rudolf — pipeline orchestration.

    Symboli Rudolf, "The Emperor," seven-crown winner and student council
    president. She plays chess (strategic sequencing) and everyone moves
    aside to let her pass (top of the call stack). Her module owns
    pipeline orchestration: running stages in the right order, wiring
    outputs of one character's module into another's, owning the entry
    point.

    If code is "do A, then B, then C, in this order, with these
    inputs/outputs," it's Rudolf's. Per-stage logic belongs in the
    stage's own character module — Rudolf only conducts. ``main.py``
    (and runtime ``Config`` toggles like ``HORSETRADER_SKIP_CACHE_REFRESH``)
    is conceptually her territory.

    Character bio: see ``rudolf.md`` alongside this file.
    """
    return cls
