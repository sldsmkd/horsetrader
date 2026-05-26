def tazuna(cls):
    """Tazuna — early-load + utilities (cross-cutting).

    Tazuna Hayakawa is the academy secretary — not officially a
    horsegirl (her green hat covers where her ears would be), the
    helpful NPC who greets every trainer arriving at Tracen Academy and
    handles a wide range of administrative/managerial tasks. Her module
    is the early-load + utility drawer: things that should be loaded
    up-front before the rest of the pipeline runs, and a collection of
    small general-purpose tools reused across the other character
    modules.

    If code is "happens before anything else can usefully run" or
    "small helper that lots of places need" and doesn't have an obvious
    home in another character's role, Tazuna is the catch-all. Be
    cautious of letting Tazuna become a junk drawer — when several
    utilities cohere into a real responsibility (especially one that
    matches another character's role), they should move out.

    History: CLAUDE.md's old "Tazuna module" section (inventory ledger
    / income-expense tracking) is superseded — that role was already
    merged into ``tracen/`` in the pre-refactor codebase and is not
    Tazuna's job now. The resource semantics (free-before-paid carats,
    20 fragments = 1 crystal) remain valid as game rules; their code
    home in the new tree is TBD.

    Character bio: see ``tazuna.md`` alongside this file.
    """
    return cls
