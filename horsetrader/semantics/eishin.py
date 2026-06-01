def eishin(cls):
    """Eishin — final output bake.

    Eishin Flash is the precise German baker who plans everything down
    to the second and never strays from the recipe. Her module is the
    terminal stage of the pipeline — it takes finalised data, ensures
    it's tidy/consistent, ensures every dated artifact is on time, and
    writes the JSON outputs (the bundle lands in ``static/json/``, the
    deploy dir). Existing baking patterns include
    decorate-at-bake (e.g. ``LoginBonuses``, ``SearchAliases``,
    ``FreePulls`` in CLAUDE.md §4 fold their YAML into the events they
    touch during the bake).

    If code is producing the final serialised form, Eishin owns it. If
    it's still transforming/normalising upstream of serialisation, it
    doesn't.

    Character bio: see ``eishin.md`` alongside this file.
    """
    return cls
