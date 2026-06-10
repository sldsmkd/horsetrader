"""Typed wire-shape DTOs for the baked bundle — Eishin's published contract.

These ``msgspec.Struct`` classes *are* the shape of ``academy.json`` and
``events.json``. They are the single source of truth the JSON Schema is
generated from (``msgspec.json.schema``) and the type the bake self-validates
against on the way out (``msgspec.json.decode``), so the schema we publish
(to ``config/schema/``) physically cannot drift from what we emit.

Ownership note: the records live with Eishin (``output/``) because they are the
*serialised* form, not a model. The model ``bake()`` methods map a model into
the matching record here; the entity mappers in ``_mappers.py`` do the same for
``academy.json``. Models depend on this module (for the return type); this
module depends on nothing but ``msgspec`` — so there is no import cycle even
though ``output`` otherwise sits above ``models``.

Field order is the emitted key order. The only intentional deviation from the
pre-msgspec output is that the ``type`` discriminator (the union tag) leads each
event record instead of sitting mid-object; JSON key order is not significant,
so the bundles are otherwise byte-comparable.
"""

import msgspec
from msgspec import UNSET, UnsetType

from horsetrader.semantics import eishin

# A baked rewards object: ``{<reward-key>: amount}`` for plain counters, plus two
# optional nested objects — a ``generator`` (``{<reward-key>: amount, "repeat":
# n}``, all-int) and a ``sequence`` (``{"type": <reward-key>, "sequence": [amount
# | null, …]}``, a daily-login schedule where ``null`` is an unmodelled/absent
# day). Both nest under a string key, so the top-level value is ``int | <object>``
# and the object's own values span ``int | str | list[int | None]`` (msgspec
# forbids a union of two dict types, so the two nested shapes share one loose
# value union rather than being modelled apart). This mirrors what Yayoi's
# ``rewards_to_baked`` emits; the dynamic keys are hers, so the schema stays a
# typed open object rather than a fixed struct. A tighter (fixed-key) schema
# would need a rewards reshape, which is Yayoi's call.
Baked = dict[str, int | dict[str, int | str | list[int | None]]]


@eishin
class GachaConfig(msgspec.Struct):
    """Game gacha constants consumed by planner-side pull math.

    Rates are decimal probabilities, not percentages: ``0.0075`` = 0.75%.
    ``featured_rates`` are the normal per-atom pickup rates by UI rarity tier;
    banner-local overrides carry exceptions when a specific pickup is compressed
    or otherwise special.
    """

    spark_threshold: int
    carats_per_pull: int
    paid_daily_pull: int
    rarity_rates: dict[str, float]
    featured_rates: dict[str, float]


# ── academy.json ──────────────────────────────────────────────────────────────

@eishin
class CharacterRecord(msgspec.Struct):
    name: str | None
    quote: str | None
    icon: str | None
    portrait: str | None


@eishin
class SupportRecord(msgspec.Struct):
    character: str | None
    display: str | None
    type: str | None
    rarity: str | None
    title: str | None
    release: str
    thumbnail: str | None
    art: str | None
    # Community search phrases the front-end typeahead matches on, folded from
    # this card's own alias entry plus its character's. Always present, often [].
    aliases: list[str]


@eishin
class TraineeRecord(msgspec.Struct):
    character: str
    variant: str | None
    rarity: int
    release: str
    thumbnail: str | None
    portrait: str | None
    # Community search phrases the front-end typeahead matches on, folded from
    # this card's own alias entry plus its character's. Always present, often [].
    aliases: list[str]


@eishin
class Academy(msgspec.Struct):
    """Top-level shape of ``academy.json`` — the three entity collections, each a
    stable-key → record map (the keys are the collection class names lowercased,
    matching ``Bake.academy``)."""

    characters: dict[str, CharacterRecord]
    supports: dict[str, SupportRecord]
    trainees: dict[str, TraineeRecord]


# ── events.json ───────────────────────────────────────────────────────────────

@eishin
class EventRecord(msgspec.Struct, tag_field="type", kw_only=True):
    """Shared event envelope. The ``type`` tag is supplied by each concrete
    subclass and leads the object. ``rewards`` defaults to ``UNSET`` — encoding
    omits the key when an event carries none, and decoding treats it as optional
    (so the bundle round-trips). Every other field is required, including those
    the subclasses add; ``kw_only`` is what lets a required subclass field sit
    alongside the base's defaulted ``rewards``. JSON key order is insignificant,
    so the kw-only field reordering doesn't affect the contract. ``start`` and
    ``end`` are fully-qualified ISO datetimes carrying the selected Period's
    timezone offset, not date-only labels."""

    start: str
    end: str
    predicted: bool
    key: str
    rewards: Baked | UnsetType = UNSET
    visible: bool | UnsetType = UNSET
    rushable: bool | UnsetType = UNSET


@eishin
class SupportBannerRecord(EventRecord, tag="support"):
    contents: list[str]
    image: str
    rate_overrides: dict[str, float] | UnsetType = UNSET


@eishin
class TraineeBannerRecord(EventRecord, tag="trainee"):
    contents: list[str]
    image: str
    rate_overrides: dict[str, float] | UnsetType = UNSET


@eishin
class ScenarioRecord(EventRecord, tag="scenario"):
    title: str | None
    image: str | None
    art: str | None


@eishin
class StoryRecord(EventRecord, tag="story"):
    title: str | None
    contents: list[str]
    image: str | None
    banner: str | None
    art: str | None


@eishin
class CMRecord(EventRecord, tag="cm"):
    name: str | None


@eishin
class ShowtimeRecord(EventRecord, tag="showtime"):
    # Rushable (post-at-start) + carries rewards via the shared envelope, unlike
    # a CM. `name` is the EN display label ("Fuji Kiseki's Showtime Event").
    name: str | None


@eishin
class NamedEventRecord(EventRecord):
    """An event record carrying a display `name` — the shared wire shape
    for the recurring wikiru event types (Trainer Skills Test, Racing Carnival,
    Aim! Strongest Team, Masters Challenge, …). Untagged intermediate; concrete
    subclasses supply the discriminator tag. Rushability is the shared optional
    flag from ``EventRecord``, not a distinct record subtype."""

    name: str | None


@eishin
class SkillTestRecord(NamedEventRecord, tag="skilltest"):
    # Recurring Trainer Skills Test; carries the fixed full-clear rewards.
    pass


@eishin
class RacingCarnivalRecord(NamedEventRecord, tag="racingcarnival"):
    pass


@eishin
class StrongestTeamRecord(NamedEventRecord, tag="strongestteam"):
    pass


@eishin
class MastersChallengeRecord(NamedEventRecord, tag="masterschallenge"):
    pass


@eishin
class FactorStudiesRecord(NamedEventRecord, tag="factorstudies"):
    pass


@eishin
class LeagueOfHeroesRecord(NamedEventRecord, tag="leagueofheroes"):
    pass


@eishin
class LegendLegRecord(msgspec.Struct):
    """One leg of a Legend Race: a ~3-day sub-window pitting the player against a
    single trainee variant. `trainee` is that trainee's academy stable key;
    `start`/`end` are the leg's EN dates (the matched window subdivided in JP-leg
    proportion). Legs are emitted in race order and tile the parent window."""

    trainee: str
    start: str
    end: str


@eishin
class LegendRaceRecord(EventRecord, tag="legendrace"):
    # A real-world race (Japan Cup, Satsuki Sho, …) run as an ordered sequence of
    # per-trainee legs. `name` is the EN race label (None until it reaches Global).
    # Not rushable — the legs are date-pinned, so there's no post-at-start choice.
    name: str | None
    legs: list[LegendLegRecord]


@eishin
class MissionRecord(EventRecord, tag="mission"):
    # A limited-mission campaign window carrying its scraped reward subset (via
    # the shared envelope). `name` is the EN title when the campaign has reached
    # Global, else the JP title. Not rushable — a mission set is farmed over its
    # window, there's no post-at-start choice. High-volume, flat catalogue.
    name: str | None


@eishin
class AnniversaryRecord(EventRecord, tag="anniversary"):
    # A scenario-shaped anniversary launch: the shared envelope plus a derived
    # display `name` ("1st Anniversary", "Half Anniversary").
    name: str | None


@eishin
class AnniversaryMissionRecord(EventRecord, tag="anniversarymission"):
    # An anniversary celebration mission: a `Mission` that references its
    # anniversary (`anniversary-N_M`) and carries its `part` (第N弾 wave —
    # 1 = countdown, 2 = on the date, 3 = continuation).
    name: str | None
    anniversary: str
    part: int


@eishin
class AnchorRecord(EventRecord, tag="anchor"):
    # Calendar point: nothing past the shared envelope (+ any curated rewards).
    pass


@eishin
class AnchoredEventRecord(EventRecord, tag="anchoredevent"):
    relation: str
    anchor: str
    name: str | UnsetType = UNSET  # curated display name; omitted when absent


# Concrete event records, discriminated on ``type``. ``EventsBundle.events`` is
# this union, which is what makes ``msgspec.json.schema`` emit the ``oneOf`` +
# discriminator and ``msgspec.json.decode`` route each record by its tag.
EventRecordUnion = (
    SupportBannerRecord
    | TraineeBannerRecord
    | ScenarioRecord
    | StoryRecord
    | CMRecord
    | ShowtimeRecord
    | SkillTestRecord
    | RacingCarnivalRecord
    | StrongestTeamRecord
    | MastersChallengeRecord
    | FactorStudiesRecord
    | LeagueOfHeroesRecord
    | LegendRaceRecord
    | MissionRecord
    | AnniversaryRecord
    | AnniversaryMissionRecord
    | AnchorRecord
    | AnchoredEventRecord
)


@eishin
class EventsBundle(msgspec.Struct):
    """Top-level shape of ``events.json`` — a flat, tz-start-sorted list."""

    events: list[EventRecordUnion]


# ── config.json ───────────────────────────────────────────────────────────────

@eishin
class ConfigBundle(msgspec.Struct):
    """Top-level shape of ``config.json`` — the non-timeline baked-config channel.

    ``reward_structures`` is a stable-key → baked-rewards map: each value is the
    same ``Baked`` shape an event's ``rewards`` carries (the per-occurrence
    numbers for a procedural stream the client expands on its own cadence).
    ``reward_maps`` adds the *rank-graded* recipes: each is a rank-label →
    baked-rewards map (e.g. Team Trials by class), the rank selected client-side.
    ``gacha`` carries standing pull-math constants: pity/spark threshold, pull
    cost, normal rarity rates, and normal featured pickup rates. Banner-local
    overrides only carry exceptions to these normal rates.
    Future baked config rides as sibling top-level keys.

    Keys are the stable-key *body* — the bucket already namespaces them, so the
    wire drops the redundant `reward-structure-` / `reward-map-` prefix the
    curated key carries (`reward-structure-dailies` → `dailies`)."""

    reward_structures: dict[str, Baked]
    reward_maps: dict[str, dict[str, Baked]]
    gacha: GachaConfig
