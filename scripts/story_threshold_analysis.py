"""Ad-hoc analysis: derive the Pt-reward ladder breakpoints for story events.

Runs OUTSIDE the bake pipeline against the warm cache. Resolves a story's cached
JA detail page through the real cache-key logic, parses the `イベントPt報酬`
(Event Pt Rewards) ladder + the mission engine, and surfaces the breakpoint
structure the play-style scaling factor will index into.

Usage:
    python -m scripts.story_threshold_analysis [ordinal]   # detail, default 15
    python -m scripts.story_threshold_analysis sweep        # all cached events
"""

import re
import sys

from lxml import html as H

from ethicrawl import Url

from horsetrader.extractors.gametora.story import _STORY_PAGE_URL_PREFIX_JA
from horsetrader.models.rewards import reward_for_gametora_icon
from horsetrader.transport.uma_client_cache import UmaClientCache

_G_ROW_EXPR = '//div[contains(@class, "missions_row_g__")]'
_MISSION_ROW_EXPR = '//div[contains(@class, "missions_row__")]'
_NUM_EXPR = './/div[contains(@class, "missions_row_num__")]'
_TEXT_EXPR = './/div[contains(@class, "missions_row_text_g__")]'
_ITEM_ID_PATTERN = re.compile(r"item_icon_(\d+)\.png")
_SUPPORT_ID_PATTERN = re.compile(r"support_card_s_(\d+)\.png")
_AMOUNT_PATTERN = re.compile(r"x([\d,]+)")
_THRESHOLD_PATTERN = re.compile(r"([\d,]+)\s*Pt")

# Mission-engine item icons (see project memory): points fill the ladder,
# roulette feeds the off-table wheel, carats are the scenario-linked anomaly.
_ICON_POINTS = "00058"
_ICON_ROULETTE = "00045"
_ICON_CARATS = "00043"


def _cached_ja_path(ordinal: int):
    url = Url(f"{_STORY_PAGE_URL_PREFIX_JA}story-event-{ordinal}")
    paths = UmaClientCache._existing_cache_paths(url)
    if not paths:
        raise SystemExit(f"No cached JA page for story-event-{ordinal} ({url})")
    return paths[-1]


def _parse_ladder(root) -> list[dict]:
    """Each Pt-reward row → {threshold, icon, amount, reward}, ascending threshold."""
    # The amount (`x300`) and threshold (`2000 Pt`) live in two sibling divs;
    # `text_content()` would glue them digit-to-digit, so read each div on its own.
    ladder: list[dict] = []
    for row in root.xpath(_G_ROW_EXPR):
        img = row.xpath(".//img")
        num = row.xpath(_NUM_EXPR)
        txt = row.xpath(_TEXT_EXPR)
        if not (img and num and txt):
            continue
        src = img[0].get("src", "")
        amt_m = _AMOUNT_PATTERN.search(num[0].text_content())
        thr_m = _THRESHOLD_PATTERN.search(txt[0].text_content())
        if not (amt_m and thr_m):
            continue
        # A row is either an item icon (mapped to a Reward) or a welfare support
        # card — the latter is its own anchor, keyed by card id.
        item_m = _ITEM_ID_PATTERN.search(src)
        sup_m = _SUPPORT_ID_PATTERN.search(src)
        if item_m:
            icon = item_m.group(1)
            cls = reward_for_gametora_icon(icon)
            reward = cls.key if cls is not None else None
        elif sup_m:
            icon = sup_m.group(1)
            reward = f"support_card:{icon}"
        else:
            continue
        ladder.append(
            {
                "threshold": int(thr_m.group(1).replace(",", "")),
                "icon": icon,
                "amount": int(amt_m.group(1).replace(",", "")),
                "reward": reward,
            }
        )
    ladder.sort(key=lambda r: r["threshold"])
    return ladder


def _parse_missions(root) -> dict[str, int]:
    """Mission-engine totals by icon: points (00058), roulette (00045), carats (00043)."""
    totals: dict[str, int] = {}
    # `missions_row__` also substring-matches `missions_row_g__`; exclude the ladder.
    for row in root.xpath(_MISSION_ROW_EXPR):
        if "missions_row_g__" in (row.get("class") or ""):
            continue
        num = row.xpath(_NUM_EXPR)
        img = row.xpath(".//img")
        if not (num and img):
            continue
        amt_m = _AMOUNT_PATTERN.search(num[0].text_content())
        icon_m = _ITEM_ID_PATTERN.search(img[0].get("src", ""))
        if not (amt_m and icon_m):
            continue
        totals[icon_m.group(1)] = totals.get(icon_m.group(1), 0) + int(
            amt_m.group(1).replace(",", "")
        )
    return totals


def _economy_totals(ladder: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in ladder:
        if r["reward"] and not r["reward"].startswith("support_card:"):
            out[r["reward"]] = out.get(r["reward"], 0) + r["amount"]
    return out


def detail(ordinal: int) -> None:
    path = _cached_ja_path(ordinal)
    print(f"# story-event-{ordinal}  cache: {path}")
    root = H.parse(str(path)).getroot()
    ladder = _parse_ladder(root)
    print(f"# {len(ladder)} Pt-reward rows\n")

    by_reward: dict[str, int] = {}
    for r in ladder:
        label = r["reward"] or f"<unmapped item-{r['icon']}>"
        by_reward[label] = by_reward.get(label, 0) + r["amount"]
    print("# full-clear totals by reward:")
    for label, total in sorted(by_reward.items(), key=lambda kv: -kv[1]):
        print(f"#   {label:>22}  {total}")
    print()

    economy = [k for k in by_reward if not k.startswith("<")]
    totals = {k: by_reward[k] for k in economy}
    cum = {k: 0 for k in economy}
    cols = sorted(economy)
    header = f"{'threshold':>10} | " + " | ".join(f"{c:>20}" for c in cols)
    print("# cumulative economy rewards at each mapped breakpoint")
    print("# " + header)
    for r in ladder:
        rew = r["reward"]
        if rew not in cum:
            continue
        cum[rew] += r["amount"]
        cells = []
        for c in cols:
            pct = f"{100 * cum[c] / totals[c]:.0f}%" if totals[c] else "-"
            cells.append(f"{cum[c]:>6}/{totals[c]:<6} {pct:>4}")
        print(f"  {r['threshold']:>10} | " + " | ".join(f"{x:>20}" for x in cells))

    print(f"\n# table totals (ceiling {ladder[-1]['threshold']} Pt):")
    for c in cols:
        print(f"#   {c:>22}  {totals[c]}")


def sweep() -> None:
    """One row per cached event — the pegs we want to confirm hold across N events."""
    cols = ("carats", "rainbow", "support", "trainee")
    head = (
        f"{'ord':>3} {'ceiling':>9} {'rows':>4} | "
        f"{'m.points':>8} {'m.roul':>6} {'m.carat':>7} | "
        f"{'carats':>6} {'rnbw':>4} {'sup':>3} {'trn':>3} {'gold':>4} | cards@Pt"
    )
    print(head)
    print("-" * len(head))
    for n in range(1, 60):
        url = Url(f"{_STORY_PAGE_URL_PREFIX_JA}story-event-{n}")
        if not UmaClientCache._existing_cache_paths(url):
            continue
        root = H.parse(str(UmaClientCache._existing_cache_paths(url)[-1])).getroot()
        ladder = _parse_ladder(root)
        if not ladder:
            print(f"{n:>3} {'(no ladder)':>9}")
            continue
        miss = _parse_missions(root)
        econ = _economy_totals(ladder)
        cards = [r["threshold"] for r in ladder if str(r["reward"]).startswith("support_card:")]
        ceiling = ladder[-1]["threshold"]
        print(
            f"{n:>3} {ceiling:>9} {len(ladder):>4} | "
            f"{miss.get(_ICON_POINTS, 0):>8} {miss.get(_ICON_ROULETTE, 0):>6} "
            f"{miss.get(_ICON_CARATS, 0):>7} | "
            f"{econ.get('free_carats', 0):>6} {econ.get('rainbow_crystal_shards', 0):>4} "
            f"{econ.get('support_tickets', 0):>3} {econ.get('trainee_tickets', 0):>3} "
            f"{econ.get('gold_crystal_shards', 0):>4} | "
            f"{','.join(str(c) for c in cards)}"
        )


# Play-style tiers → absolute Pt target on the ladder (anchors are absolute, not
# ceiling fractions). dedicated/unhinged = full clear (the per-event ceiling).
_TIERS = (("sweetie", 150_000), ("casual", 400_000), ("focused", 600_000))


def _bundle_at(ladder: list[dict], cap: int) -> dict[str, int]:
    """Cumulative economy bundle for every ladder row with threshold <= cap.
    Welfare copies counted under 'welfare'."""
    out: dict[str, int] = {}
    for r in ladder:
        if r["threshold"] > cap:
            break  # ladder is threshold-sorted
        rew = r["reward"]
        if rew is None:
            continue
        key = "welfare" if rew.startswith("support_card:") else rew
        out[key] = out.get(key, 0) + r["amount"]
    return out


def _fmt_bundle(b: dict[str, int]) -> str:
    order = [
        ("free_carats", "carat"),
        ("rainbow_crystal_shards", "🌈"),
        ("support_tickets", "sup"),
        ("trainee_tickets", "trn"),
        ("welfare", "card"),
    ]
    return " ".join(f"{lbl}:{b.get(k, 0)}" for k, lbl in order)


def tiers() -> None:
    """Per-event ladder bundle at each tier — validates the tier model + flags extras."""
    for n in range(1, 60):
        url = Url(f"{_STORY_PAGE_URL_PREFIX_JA}story-event-{n}")
        if not UmaClientCache._existing_cache_paths(url):
            continue
        root = H.parse(str(UmaClientCache._existing_cache_paths(url)[-1])).getroot()
        ladder = _parse_ladder(root)
        if not ladder:
            continue
        ceiling = ladder[-1]["threshold"]
        print(f"story-{n:02d}  ceiling {ceiling:>9}")
        for name, cap in _TIERS:
            b = _bundle_at(ladder, cap)
            mlb = "  <-- welfare card (base copy from ladder)" if b.get("welfare") else ""
            print(f"   {name:>8} @{cap:>7}: {_fmt_bundle(b)}{mlb}")
        full = _bundle_at(ladder, ceiling)
        print(f"   {'full':>8} @{ceiling:>7}: {_fmt_bundle(full)}")
        print()


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else "15"
    if arg == "sweep":
        sweep()
    elif arg == "tiers":
        tiers()
    else:
        detail(int(arg))


if __name__ == "__main__":
    main()
