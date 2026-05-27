def matikanefukukitaru(cls):
    """Matikanefukukitaru — prediction oracle.

    Matikane Fukukitaru is the fortune-telling fanatic. Her module
    divines what Global's future schedule will look like. She consumes
    the regression model that Agnes Tachyon assembles from the confirmed
    JP↔EN corpus, applies the deferred outlier rules hook (CLAUDE.md §4
    "Prediction outlier rules") as a post-processing pass, and emits
    final EN predicted dates with ``predicted=True``.

    The raw statistical machinery (corpus assembly, kernel weighting,
    model fitting) belongs to ``@tachyon``. Mati's job is interpretation:
    she takes Tachyon's numbers, applies oracle knowledge about
    scheduling exceptions, and produces the answer a player can act on.

    If code answers "*when will this specific event appear on Global?*",
    it's Matikanefukukitaru's. If it answers "*what is the local
    acceleration model for JP day D?*", it's Tachyon's.

    Character bio: see ``matikanefukukitaru.md`` alongside this file.
    """
    return cls
