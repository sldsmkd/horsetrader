def shakur(cls):
    """Shakur — transit / web transport.

    Air Shakur is the logical-approach racer whose primary like is
    programming and who only trusts data she has collected herself. Her
    module owns the transport layer: actual HTTP requests, cache I/O,
    robots.txt fetching/parsing, headless browser session management,
    retry/backoff logic. Where Transcend is the informant who knows
    what to gather and what to do with the bytes once they arrive,
    Shakur is the one who physically goes and gets them over the wire
    and routes them through the cache.

    If code is talking to a web server, reading/writing a cache file,
    parsing robots.txt, or managing a Chromium session, it's Shakur's.
    ``UmaClient`` and the cache machinery (including the
    ``HORSETRADER_SKIP_CACHE_REFRESH`` env var via ``Config``) are
    conceptually hers — Transcend calls into Shakur to fetch a URL;
    Shakur decides whether to hit the network or serve from cache.

    Character bio: see ``shakur.md`` alongside this file.
    """
    return cls
