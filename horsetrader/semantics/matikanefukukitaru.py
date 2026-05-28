def matikanefukukitaru(cls):
    """Matikanefukukitaru — prediction oracle.

    Matikane Fukukitaru is the fortune-telling fanatic. Her module
    divines what Global's future schedule will look like — vibes-based
    heuristics over the in-memory Timeline, not a fitted statistical
    model. Each predictor reads JP Periods (and any confirmed UTC ones
    Transcend already stamped) and appends a predicted UTC ``Period``
    with ``predicted=True`` for events that need one.

    Current heuristics in ``timeline/predictors/``:

    - ``ScenarioPredictor`` — projects unscheduled scenarios via a global
      JP→UTC acceleration on the Timeline, then snaps to the nearest
      weekday with historical EN releases.
    - ``BannerPredictor`` — snaps a banner to its co-released scenario's
      EN date when one exists.

    A deferred outlier-rules hook is planned (e.g. banners following a
    Champions Meeting in JP get pushed back to avoid EN-side CM overlap)
    — see ``docs/prediction.md``.

    If code answers "*when will this specific event appear on Global?*",
    it's Matikanefukukitaru's.

    Character bio: see ``matikanefukukitaru.md`` alongside this file.
    """
    return cls
