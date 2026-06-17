from horsetrader.semantics import tazuna


@tazuna
class StableKey(str):
    """A stable key for models — the id every model and the baked output use.

    Scheme: ``<type>-<body>``, a fixed namespace token first so a key is
    routable by splitting on the first ``-``. The body either coalesces around a
    game-db id (Gametora) or is an invented slug/sequence; lowercase
    alphanumeric with dashes, slug-like.

    Namespaces:
      - entities — ``char-<slug>``, ``support-<id>-<slug>``, ``trainee-<id>-<slug>``
        (the game id stays in the body; `KEY_PREFIX` ClassVars own the prefix)
      - events — ``banner-<id>``, ``scenario-<nn>``, ``story-<nnn>``, ``cm-<nnn>``,
        ``holiday-<kind>-<year>``, ``anniversary-<version>``, and dedicated
        event-family prefixes such as ``showtime-``, ``legendrace-``, and
        ``mission-``.
      - ``item-<id>``
      - config — ``reward-structure-<slug>`` (a standing reward structure) and
        ``reward-map-<slug>`` (a rank-graded reward, whose per-tier structures
        carry derived ``reward-structure-<body>-<rank>`` keys); both baked to
        ``config.json``, identity only, never referenced by the timeline

    Reward keys are *not* stable keys — they're a fixed serialisation vocab
    bundled under an event's ``rewards`` object (``{"free_carats": 2160,
    "support_tickets": 2, …}``), bare + pluralised, since the wrapper already
    namespaces them.
    """

    pass

    # TODO: maybe add validation here and hook with a registry, not a priority
