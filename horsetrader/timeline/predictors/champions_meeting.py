from datetime import datetime, timedelta
from statistics import mean

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import ChampionsMeeting, SupportBanner, TraineeBanner
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor

logger = Logger.get(__name__)

_DEFAULT_EN_SPAN = timedelta(days=10)

# Hardened-LiveOps era: from this ordinal on, every late-month CM is preceded
# by a solo new-character banner ~3 days earlier (see _pass_solo_banner_anchor).
_SOLO_BANNER_ERA_FROM = 28
# Banner→CM-start offset (days) that counts as the day-20 anchor slot. The good
# anchors sit at +0..+5; the day-13 mid-month banner lands at +7/+8 and is
# excluded so those CMs fall through to the final-day mapper instead.
_SOLO_BANNER_MAX_LEAD = 5
# JST→UTC compresses the calendar, which would crush the banner→CM lead-in
# (competitive-prep time players actually need). Push the banner-anchored CM
# start this many days later than the raw JP lead to preserve that window.
_LEAD_PRESERVATION_NUDGE = timedelta(days=2)


def _cm_ordinal(key: object) -> int | None:
    """Integer ordinal from a ``cm-NNN`` stable key, or None if unparseable."""
    try:
        return int(str(key).split("-")[1])
    except (IndexError, ValueError):
        return None


@matikanefukukitaru
class ChampionsMeetingPredictor(Predictor):
    """Predict EN Champions Meeting windows — anchored on the FINAL day.

    A CM is two different spans depending on the source (see docs/domain.md):
    Gametora records only competitive play, so the JP scrape is always exactly
    a 6-day *competition* window; the EN release is the full *availability*
    window (usually 10 days) that adds the lead-in on the front. So the generic
    fallthrough is wrong on both counts — it carries `jp.span` across (the fixed
    6 days, not ~10) and maps the JP *opening* day.

    The competition **final** is precomputed and immune to meta shifts, while
    the opening drifts: Cygames avoids dropping meta-changing banners during the
    competitive phase (the Oguri Cap rule), so registration/qualifier timing
    flexes but the final is fixed. We therefore anchor on the final — map JP
    final-day → EN final-day through a `DateMapper` built from confirmed CM
    pairs, then rebuild the EN availability window *backwards* from that final
    using the typical confirmed EN span. Final-to-final also sidesteps the
    asymmetric front-padding (EN's window includes registration days the JP
    scrape omits) for free.

    Both passes place the EN *availability* window (mean span of confirmed EN
    CMs, ~10d), never the 6-day JP competition span.

    Pass 1 (solo-banner anchor): in the hardened LiveOps era (cm-028+, late-2023
    on) every late-month CM is preceded by a *solo* new-character banner (a
    Character Gacha with no same-day Support Gacha — the usual drops are paired)
    landing on JP day-of-month 20 ±2, with the CM start ~3 days later (offset
    +2..+4 across 15/15 such CMs; median 3). When that banner has an EN date
    (confirmed or predicted by `BannerPredictor` upstream), the CM EN start =
    banner EN drop + the JP banner→CM lead + a +2d nudge that preserves the
    lead-in against JST→UTC compression (the gap would otherwise crush the
    competitive-prep window players need). Same shape as `BannerPredictor`
    pass 1 snapping to scenarios. NB this is *timing* only: whether the debut
    character actually suits the cup's track/distance is opportunistic, not a
    rule (verified 2 fits / 2 misses — Pandora 2200m & Grass Wonder/Arima fit;
    No Reason/mile & Admire Groove/dirt don't), so don't infer meta-fit from it.

    Pass 2 (final-day mapper): every CM pass 1 didn't reach — pre-era CMs, and
    era CMs whose anchor banner has no EN date yet. Map JP final-day → EN
    final-day through a `DateMapper` built from confirmed CM pairs, then rebuild
    the EN availability window *backwards* from that final. Final-to-final
    sidesteps the asymmetric front-padding (EN's window includes registration
    days the JP scrape omits) for free.
    """

    def predict(self, timeline: Timeline) -> int:
        # Both passes place the EN *availability* window (not the 6-day JP
        # competition span): mean span over confirmed EN CMs, default ~10d until
        # enough are confirmed.
        confirmed_en = [
            en
            for event in self._timeline
            if isinstance(event, ChampionsMeeting)
            and next((p for p in event.periods if p.tzinfo == JST), None)
            and (en := next((p for p in event.periods if p.tzinfo == UTC), None))
        ]
        if confirmed_en:
            en_span = timedelta(
                days=round(mean((p.end - p.start).days for p in confirmed_en))
            )
        else:
            en_span = _DEFAULT_EN_SPAN
        return self._pass_solo_banner_anchor(en_span) + self._pass_final_mapper(en_span)

    def _pass_solo_banner_anchor(self, en_span: timedelta) -> int:
        # Solo new-character banners: a TraineeBanner with no SupportBanner on the
        # same JP start day (paired drops are the norm; the lone one is the
        # day-20 CM-prep slot). Index them by JP start date.
        support_jp_days = {
            jp.start.date()
            for event in self._timeline
            if isinstance(event, SupportBanner)
            and (jp := next((p for p in event.periods if p.tzinfo == JST), None))
        }
        # Only solo banners that already carry an EN date are usable anchors; a
        # CM with no EN-dated anchor banner just falls through to pass 2.
        solo: list[tuple[Period, Period]] = []
        for event in self._timeline:
            if not isinstance(event, TraineeBanner):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None or jp.start.date() in support_jp_days:
                continue
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if en is not None:
                solo.append((jp, en))

        count = 0
        for event in self._timeline:
            if not isinstance(event, ChampionsMeeting):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            ordinal = _cm_ordinal(event.key)
            if ordinal is None or ordinal < _SOLO_BANNER_ERA_FROM:
                continue
            cm_jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if cm_jp is None:
                continue
            cm_start = cm_jp.start
            # Nearest solo banner starting 0..MAX_LEAD days before the CM. This
            # day-20 window excludes the day-13 mid-month banner (lead +7/+8),
            # leaving those CMs for the final-day mapper.
            candidates = [
                (jp, en)
                for jp, en in solo
                if 0
                <= (cm_start.date() - jp.start.date()).days
                <= _SOLO_BANNER_MAX_LEAD
            ]
            if not candidates:
                continue  # no EN-dated anchor banner in the day-20 window — leave for pass 2
            banner_jp, banner_en = min(
                candidates,
                key=lambda pair: cm_start - pair[0].start,
            )
            lead = cm_jp.start.date() - banner_jp.start.date()
            # CM EN start = banner EN drop + the JP banner→CM lead, nudged later
            # to preserve the lead-in against JST→UTC compression. Span is the EN
            # availability window (~10d), not the 6-day JP competition span.
            start = (
                datetime(
                    banner_en.start.year,
                    banner_en.start.month,
                    banner_en.start.day,
                    22,
                    tzinfo=UTC,
                )
                + lead
                + _LEAD_PRESERVATION_NUDGE
            )
            event.periods.append(Period(start=start, span=en_span, predicted=True))
            count += 1
        return count

    def _pass_final_mapper(self, en_span: timedelta) -> int:
        confirmed: list[tuple[Period, Period]] = []
        for event in self._timeline:
            if not isinstance(event, ChampionsMeeting):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                confirmed.append((jp, en))

        # Need at least two confirmed finals for the DateMapper to interpolate
        # the JST→UTC warp; with fewer, leave CMs for the fallthrough.
        if len(confirmed) < 2:
            return 0

        mapper = DateMapper(JST, UTC)
        for jp, en in confirmed:
            mapper.add(jp.end, en.end)

        count = 0
        for event in self._timeline:
            if not isinstance(event, ChampionsMeeting):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            final_day = mapper.predict(jp.end, UTC)
            # EN CMs close (and finals land) at 22:00 UTC, the canonical Global
            # content instant; the window opens en_span earlier.
            end = datetime(
                final_day.year, final_day.month, final_day.day, 22, tzinfo=UTC
            )
            event.periods.append(
                Period(start=end - en_span, span=en_span, predicted=True)
            )
            count += 1
        return count
