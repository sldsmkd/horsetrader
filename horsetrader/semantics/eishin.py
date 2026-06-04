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

    She also owns the **contract** for what crosses the wire, not just the
    code that writes it: the wire records here, and ``TracenObject`` — the
    model apex whose sole meaning is "this gets baked" (its only field is the
    ``StableKey`` every record is addressed by). The leaves below it are
    produced by other characters (Digitan/Daitaku/Yayoi); the marker that
    *admits* a model to the bundle is Eishin's, because defining the baked set
    is the serialiser's contract.

    If code is producing the final serialised form — or defining what may
    enter it — Eishin owns it. If it's still transforming/normalising upstream
    of serialisation, it doesn't.

    Character bio: see ``eishin.md`` alongside this file.
    """
    return cls
