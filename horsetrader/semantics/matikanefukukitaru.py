def matikanefukukitaru(cls):
    """Matikanefukukitaru — prediction.

    Matikane Fukukitaru is the fortune-telling fanatic. Her module is
    the prediction layer — it takes the messy ball of confirmed JP and
    EN events that upstream stages have gathered and divines what
    Global's future schedule will look like. The LOESS-style local
    weighted regression (CLAUDE.md §4 "Prediction engine upgrade") and
    the deferred outlier rules hook (CLAUDE.md §4 "Prediction outlier
    rules") live here.

    If code answers "*when will this happen on Global?*" or "*how do JP
    signals project into EN?*", it's Matikanefukukitaru's. Pure
    historical assembly is upstream; final serialisation is downstream.

    Character bio: see ``matikanefukukitaru.md`` alongside this file.
    """
    return cls
