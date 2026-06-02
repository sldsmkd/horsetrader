def eishin(cls):
    """Eishin — final output bake.

    Eishin Flash is the precise German baker who plans everything down
    to the second and never strays from the recipe. Her module is the
    terminal stage of the pipeline — it takes finalised data, ensures
    it's tidy/consistent, ensures every dated artifact is on time, and
    writes the JSON outputs (the bundle lands in ``static/json/``, the
    deploy dir). She maps finalised models into their wire records
    (``output/_records.py`` / ``_mappers.py``) and self-validates the
    encoded bundle; she does **not** fetch or fold source data herself.
    Curated values (aliases, pull counts, …) reach the models *upstream*
    via Digitan's enrichers / Daitaku's event build, and the bake only
    reads them — see the "Don't bypass the models" standard.

    If code is producing the final serialised form, Eishin owns it. If
    it's still transforming/normalising upstream of serialisation, it
    doesn't.

    Character bio: see ``eishin.md`` alongside this file.
    """
    return cls
