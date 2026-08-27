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

from typing import Annotated, Literal

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
class ThreeSizesRecord(msgspec.Struct):
    # Bust / waist / hips in cm; any may be `null` (NPCs, or simply not on file).
    bust: int | None
    waist: int | None
    hips: int | None


@eishin
class BirthdayRecord(msgspec.Struct):
    # Month + day only — these girls are ageless.
    month: int
    day: int


@eishin
class BioRecord(msgspec.Struct):
    """A character's vital-statistics bundle. Every member is optional: not all
    characters carry this (NPCs never had it, or umapyoi hasn't filled it in).
    `three_sizes` is always the container with nullable members; `birthday` /
    `height` (cm) are `null` wholesale when absent."""

    three_sizes: ThreeSizesRecord
    birthday: BirthdayRecord | None
    height: int | None


@eishin
class CharacterRecord(msgspec.Struct):
    name: str | None
    quote: str | None
    icon: str | None
    portrait: str | None
    bio: BioRecord


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
    # The canonical source-of-record deep-link (Gametora's English entity page),
    # for the card surface's "full stats" link. `null` when no source URL is on
    # the record's provenance; the front-end omits the link then.
    source: str | None


@eishin
class SurfaceAptitudesRecord(msgspec.Struct):
    turf: str
    dirt: str


@eishin
class DistanceAptitudesRecord(msgspec.Struct):
    short: str
    mile: str
    medium: str
    long: str


@eishin
class StrategyAptitudesRecord(msgspec.Struct):
    front: str
    pace: str
    late: str
    end: str


@eishin
class AptitudesRecord(msgspec.Struct):
    """A trainee's base aptitudes across all three axes. Each grade is a rank
    *slug* (`"g"` … `"s"`) — the front-end maps it to both the displayed letter
    and the `--ht-colour-aptitude-*` token. The whole object is `null` when the
    source page carried no aptitude block."""

    surface: SurfaceAptitudesRecord
    distance: DistanceAptitudesRecord
    strategy: StrategyAptitudesRecord


@eishin
class TraineeRecord(msgspec.Struct):
    character: str
    # Costume *category*, normalised by the `CostumeVariants` enum to its
    # display-ready EN label (e.g. "New Year"); always present. The FE has no
    # slug->label map, so the wire carries the human form, not the slug.
    variant: str
    # Unique per-card *flavour* title (EN-preferring, e.g. "[Jubilant
    # Star・Auspicious Crane]"); `null` when no source carries one.
    title: str | None
    rarity: int
    release: str
    thumbnail: str | None
    portrait: str | None
    # Community search phrases the front-end typeahead matches on, folded from
    # this card's own alias entry plus its character's. Always present, often [].
    aliases: list[str]
    # The canonical source-of-record deep-link (Gametora's English entity page),
    # for the card surface's "full stats" link. `null` when no source URL is on
    # the record's provenance; the front-end omits the link then.
    source: str | None
    # Base aptitudes (surface / distance / running style), each grade a `"g"`…`"s"`
    # slug. `null` when the source page carried no aptitude block.
    aptitudes: AptitudesRecord | None


@eishin
class RacetrackRecord(msgspec.Struct):
    name: str | None
    icon: str | None


@eishin
class CourseRecord(msgspec.Struct):
    racetrack: str
    surface: str
    distance: int
    variant: str | None
    diagram: str | None


@eishin
class RaceOccurrenceRecord(msgspec.Struct):
    """One fixed appearance of a named race in the career calendar."""

    course: str | None
    career_class: Literal["junior", "classic", "senior"]
    month: Annotated[int, msgspec.Meta(ge=1, le=12)]
    half: Literal["early", "late"]


@eishin
class RaceRecord(msgspec.Struct):
    name: str | None
    grade: str
    surface: str
    # null for the JBC trio — real G1s run at a randomly generated distance/venue.
    distance: int | None
    racetrack: str | None
    banner: str | None
    occurrences: list[RaceOccurrenceRecord]


@eishin
class SelectorRecord(msgspec.Struct):
    """An anniversary card-exchange voucher pool — its ``name`` and what it's valid
    for. The pool is a recipe the client expands: every ``kind`` card up to and
    including the ``cutoff`` banner (by release order), minus ``excludes``. ``kind``
    is ``"ssr_support"`` | ``"trainee"``. How it's acquired (free grant vs paid
    packs) is a separate reward layer, not carried here."""

    name: str
    anniversary: str
    kind: str
    cutoff: str
    excludes: list[str]


@eishin
class Academy(msgspec.Struct):
    """Top-level shape of ``academy.json`` — the entity collections, each a
    stable-key → record map (the keys are the collection class names lowercased,
    matching ``Bake.academy``)."""

    characters: dict[str, CharacterRecord]
    courses: dict[str, CourseRecord]
    races: dict[str, RaceRecord]
    racetracks: dict[str, RacetrackRecord]
    selectors: dict[str, SelectorRecord]
    supports: dict[str, SupportRecord]
    trainees: dict[str, TraineeRecord]


# ── images.json ───────────────────────────────────────────────────────────────

@eishin
class ImagesBundle(msgspec.Struct):
    """Top-level shape of ``images.json`` — every published image's intrinsic
    dimensions, keyed by its published url (the same string each image field in
    the other bundles serialises). Each value is a ``[width, height]`` pair. The
    front-end's image broker resolves dims by url, so every ``<img>`` can carry
    explicit ``width``/``height`` (no max-content intrinsic surprises, no layout
    shift). Populated by Curren Chan as she publishes; see ``ImageRegistry``.

    Each value is a ``[width, height]`` list (not a 2-tuple: the tuple schema
    generates as ``never[]`` in json-schema-to-typescript; a list emits clean
    ``number[]``, and the one consumer — the FE broker — destructures it)."""

    dims: dict[str, list[int]]


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
    # Reward era — selects the play-style `reward-map-story-<era>` the client
    # expands; `null` for proto-era stories (1–5, historical, not modelled).
    # Stories carry no `rewards` of their own (the base envelope omits the key).
    era: str | None


@eishin
class MainStoryRecord(EventRecord, tag="mainstory"):
    # A main-story chapter release — a single-day welfare milestone (permanent
    # campaign, not a windowed event; start == end). `title` is the Japlish chapter
    # title (EN-projected). `contents` are the welfare reward cards it grants — a
    # combo of support-* and, on the part finales, the ★3 trainee-*. `banner` is the
    # chapter banner. The flattened story-clear carats ride the shared `rewards`
    # envelope (all the per-episode jewels land on the one release day).
    title: str | None
    contents: list[str]
    banner: str | None


@eishin
class CMRecord(EventRecord, tag="cm"):
    name: str | None
    banner: str | None | UnsetType = UNSET


@eishin
class ShowtimeRecord(EventRecord, tag="showtime"):
    # Rushable (post-at-start) + carries rewards via the shared envelope, unlike
    # a CM. `name` is the EN display label ("Fuji Kiseki's Showtime Event").
    name: str | None
    banner: str | None


@eishin
class NamedEventRecord(EventRecord):
    """An event record carrying a display `name` — the shared wire shape
    for the recurring wikiru event types (Trainer Skills Test, Racing Carnival,
    Dream Team, Masters Challenge, …). Untagged intermediate; concrete
    subclasses supply the discriminator tag. Rushability is the shared optional
    flag from ``EventRecord``, not a distinct record subtype."""

    name: str | None


@eishin
class SkillTestRecord(NamedEventRecord, tag="skilltest"):
    # Recurring Trainer Skills Test; carries the fixed full-clear rewards.
    banner: str | None


@eishin
class RacingCarnivalRecord(NamedEventRecord, tag="racingcarnival"):
    banner: str | None


@eishin
class StrongestTeamRecord(NamedEventRecord, tag="strongestteam"):
    banner: str | None


@eishin
class MastersChallengeRecord(NamedEventRecord, tag="masterschallenge"):
    banner: str | None


@eishin
class FactorStudiesRecord(NamedEventRecord, tag="factorstudies"):
    banner: str | None


@eishin
class LeagueOfHeroesRecord(NamedEventRecord, tag="leagueofheroes"):
    banner: str | None


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
    banner: str | None
    legs: list[LegendLegRecord]


@eishin
class MissionRecord(EventRecord, tag="mission"):
    # A limited-mission campaign window carrying its scraped reward subset (via
    # the shared envelope). `name` is the EN title when the campaign has reached
    # Global, else the JP title. Rushable — its fixed mission set can be completed
    # before the window closes. `image` is the scraped Gametora mission logo,
    # processed into the static image bundle.
    name: str | None
    image: str | None


@eishin
class AnniversaryRecord(EventRecord, tag="anniversary"):
    # A scenario-shaped anniversary launch: the shared envelope plus a derived
    # display `name` ("1st Anniversary", "Half Anniversary").
    name: str | None
    # Paid selector packs the store offered this anniversary, per type (0/1/2 —
    # the dolphin/whale escalation). Per-level paid-carat cost = the ladder in
    # config `reward_maps.anniversary-selectors`.
    paid_ssr_selectors: int = 0
    paid_trainee_selectors: int = 0


@eishin
class AnniversaryMissionRecord(EventRecord, tag="anniversarymission"):
    # An anniversary celebration mission: a `Mission` that references its
    # anniversary (`anniversary-N_M`) and carries its `part` (第N弾 wave —
    # 1 = countdown, 2 = on the date, 3 = continuation).
    name: str | None
    image: str | None
    banner: str | None
    anniversary: str
    part: int
    # The distinct welfare support cards this mission grants (Part 2's anniversary
    # card — granted to MLB across mission tiers + login, but contents is the set).
    contents: list[str]


@eishin
class ScenarioMissionRecord(EventRecord, tag="scenariomission"):
    # A scenario-launch celebration mission: a `Mission` that references its
    # scenario (`scenario-NN`). One-shot launch income, not the grind catalogue —
    # split out of `Mission` the same way anniversary missions are.
    name: str | None
    image: str | None
    scenario: str


@eishin
class TrainingPassRecord(EventRecord, tag="trainingpass"):
    # The Training Pass battle-pass window: a recurring below-line event carrying
    # its FREE-track rewards via the shared envelope. The premium track is the
    # toggle-gated boost and rides `reward_maps["training-pass"]["premium"]` in
    # config.json, selected client-side — not a field here. `name` is the constant
    # EN display label ("Training Pass"). Not rushable — points accrue across the
    # window, there's no post-at-start choice.
    name: str | None


@eishin
class HolidayRecord(EventRecord, tag="holiday"):
    # A seasonal holiday / campaign launch (Golden Week, New Year, marketing
    # tie-ins): the shared envelope (a real start/end window, not the old span-0
    # point) plus the themed display `name`.
    name: str
    banner: str | None | UnsetType = UNSET
    # Distinct welfare support cards granted by the campaign; copy timing/count
    # stays with the source campaign rather than pretending cards are currency.
    contents: list[str] | UnsetType = UNSET


# Concrete event records, discriminated on ``type``. ``EventsBundle.events`` is
# this union, which is what makes ``msgspec.json.schema`` emit the ``oneOf`` +
# discriminator and ``msgspec.json.decode`` route each record by its tag.
EventRecordUnion = (
    SupportBannerRecord
    | TraineeBannerRecord
    | ScenarioRecord
    | StoryRecord
    | MainStoryRecord
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
    | ScenarioMissionRecord
    | TrainingPassRecord
    | HolidayRecord
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


# ── stats.json ──────────────────────────────────────────────────────────────

@eishin
class BakeStats(msgspec.Struct):
    """Top-level shape of ``stats.json`` — the bake's own vanity counters, surfaced
    by the front-end MANGOHORSE HUD (Eishin Flash filing her own production report).

    These are facts about the *bake*, not planner data: when it last ran, how large
    the corpus is, how much of the timeline Eishin had to forecast, and how much
    Japlish she had to ship as a JP fallback for want of an EN translation. The HUD
    reads them once and displays them statically beneath the live runtime gauges.

    ``baked_at`` is a fully-qualified UTC timestamp — the Global server runs on UTC
    and players calibrate around it, so the freshness stamp rides the clock the
    audience already reads; ``build_s`` the total bake wall-clock. ``predicted`` /
    ``confirmed`` split the baked events by whether their EN window was forecast or
    already announced. ``sources`` is how many source documents (HTML + JSON) Shakur
    read to build the bundle — the credibility number. ``no_en`` is the distinct
    count of Japlish that crossed the wire untranslated — the live tally of the
    translation-gap backlog."""

    baked_at: str
    build_s: float
    events: int
    predicted: int
    confirmed: int
    entities: int
    sources: int
    no_en: int
