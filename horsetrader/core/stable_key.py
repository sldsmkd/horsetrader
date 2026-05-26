from horsetrader.semantics import tazuna


@tazuna
class StableKey(str):
    """A stable key for models, just a marker currently
    We use these as the ids for all models, and either coalesce around gametora ids which come from the game db or invent or own.
    alphanumeric with dashes only; similar to a slug.
    """

    pass

    # TODO: maybe add validation here and hook with a registry, not a priority
