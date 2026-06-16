def robroy(cls):
    """Rob Roy — the librarian / news corpus.

    Zenno Rob Roy is the bibliophile student library assistant at Tracen
    Academy: a voracious reader who lives among the shelves and prides
    herself on unmatched wayfinding. Her module owns the *read model over
    the news corpus* — the ~2,500-article Umapyoi news archive. Where
    Transcend fetches and caches the raw leaves (the freeform
    ``UmapyoiNews`` source adapter) and Shakur moves the bytes over the
    wire, Rob Roy is the one who *knows the collection*: she catalogues it
    into compact searchable records, finds the article you're after by
    title, label, or date window, and surfaces known signals (e.g. the
    League of Heroes team-building announcements).

    If code is querying, indexing, or navigating the news corpus — not
    fetching it, not deciding what a match *means* for the domain — it's
    Rob Roy's. She deliberately stops at the article index: she does not
    create events, decide source authority, or mutate models; callers own
    the domain interpretation of anything she retrieves.

    Character bio: see ``robroy.md`` alongside this file.
    """
    return cls
