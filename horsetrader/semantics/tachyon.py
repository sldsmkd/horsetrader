def tachyon(cls):
    """Agnes Tachyon — EN corpus assembly and regression engine.

    Tachyon is the mad scientist who fears no law and respects no temporal
    boundary. Her module has two inseparable responsibilities:

    1. **EN historical retrieval.** She tears through the timeline to
       assemble the confirmed JP↔EN event-date corpus: every pair where
       both the JP date and the actual EN date are known. This is the raw
       experimental data that powers the model.

    2. **Regression engine.** She fits the LOESS-style local weighted
       regression described in CLAUDE.md §4 "Prediction engine upgrade":
       Gaussian-kernel-weighted linear ``en = a*jp + b`` fitted from the
       K nearest confirmed pairs by JP-day proximity. The model, its
       residuals, and any future confidence-interval machinery all live
       here.

    Tachyon produces numbers. She does not produce predictions — that is
    Matikanefukukitaru's domain. If code answers "*what was the
    acceleration between JP and EN?*" or "*how do I fit a local model to
    the corpus?*", it belongs here. If code answers "*when will this
    specific event appear on Global?*", it belongs to Mati, who consumes
    Tachyon's model.

    Character bio: see ``tachyon.md`` alongside this file.
    """
    return cls
