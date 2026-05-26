def currenchan(cls):
    """Curren Chan — image processing.

    Curren Chan is the Umastagram selfie goddess with 3 million followers,
    whose entire personal brand is making sure every image looks its absolute
    cutest. Her module owns image processing: taking raw source images
    (icons, portraits, art) that Shakur has fetched, resizing them to the
    target dimensions, and re-encoding them as WebP for the site to consume.
    Where Eishin produces the final JSON artifacts, Curren Chan produces the
    final image artifacts — both end up in the shared ``generated/`` tree.

    If code is resizing, re-encoding, or otherwise transforming image bytes
    into their final on-disk form, it's Curren Chan's. The commented-out
    ``# from horsetrader.image import Image`` lines scattered through
    extractor code (``extractors/gametora/character.py``,
    ``extractors/gametora/characters.py``, ``extractors/umapyoi/character.py``)
    and the ``icon``/``portrait`` placeholder fields in ``Character`` are her
    territory waiting to come back online. Image-processing module placement
    is TBD — most likely ``horsetrader/image/`` since that name's already
    referenced throughout.

    Character bio: see ``currenchan.md`` alongside this file.
    """
    return cls
