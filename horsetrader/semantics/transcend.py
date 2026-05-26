def transcend(cls):
    """Transcend — ingest / scraping.

    Transcend ("Tran") is the "informant seeking the unknown," ears
    always aware of gossip, who pops into any group hungry for
    information she might find. Her module owns ingest and scraping —
    knowing what upstream sources exist (Gametora, fan wikis
    wikiwiki/wikiru per CLAUDE.md §4 "TrackInfo / CM track data",
    Cygames announcements), navigating those sources, and
    parsing/normalising raw HTML/JSON into project-shaped data. She
    delegates the actual web mechanics to Shakur.

    If code is "given a URL, extract structured data from it" or
    "scrape this page and turn it into a record," it's Transcend's. If
    it's "talk to the web server, manage the cache, handle robots.txt"
    — that's Shakur's territory. Once data has been normalised into the
    project's own models, it has left both their hands.

    Character bio: see ``transcend.md`` alongside this file.
    """
    return cls
