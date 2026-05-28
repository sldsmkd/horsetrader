def daitaku(cls):
    """Daitaku — the *when*.

    Daitaku Helios is the party girl whose phone is buried under
    notifications — never missing an invite, always knows what's
    happening, where, and when. Her module owns the calendar primitives:
    ``Period``, ``Periods``, and the event-time math that every other
    character leans on.

    Helios doesn't reason about timezones — she just stores whatever
    ``tzinfo`` lives on a Period's start datetime, and ``Periods``
    enforces at most one Period per tzinfo so callers can ask "do I
    have a UTC one?" without scanning. JST↔UTC interpretation,
    cross-zone scheduling, and Global-side predictions are
    ``@matikanefukukitaru``'s problem, not hers.

    If code is answering "*when does this happen?*" or doing date
    arithmetic on a Period, it's Daitaku's.

    Character bio: see ``daitaku.md`` alongside this file.
    """
    return cls
