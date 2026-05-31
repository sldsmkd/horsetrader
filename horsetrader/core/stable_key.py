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
        ``anchor-<kind>-<ver>`` (``<kind>`` is parsed back for prediction routing),
        and anchored events ``before-``/``after-<body>`` (the relation prefix is
        the namespace; ``during-`` is YAML authoring sugar normalised to
        ``after-`` at load)
      - ``item-<id>``

    Reward keys are *not* entity keys (a fixed serialisation vocab, not models),
    so they use an underscore: ``reward_carats``, ``reward_trainee_tickets``, ….
    """

    pass

    # TODO: maybe add validation here and hook with a registry, not a priority
