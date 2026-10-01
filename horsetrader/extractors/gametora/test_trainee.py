from datetime import datetime

from lxml import html

from horsetrader.core import JST
from horsetrader.enums import AptitudeRank

from .trainee import GametoraTrainee


def test_release_date_uses_semantic_definition_list():
    tree = html.fromstring("""
        <main>
          <dl><div><dt>実装日</dt><dd><span>2026年9月30日</span></dd></div></dl>
        </main>
    """)

    assert GametoraTrainee._extract_release_date(tree).start == datetime(
        2026, 9, 30, 12, tzinfo=JST
    )


def test_aptitudes_use_semantic_definition_labels():
    labels = [
        ("芝", 12),
        ("ダート", 0),
        ("短距離", 4),
        ("マイル", 8),
        ("中距離", 12),
        ("長距離", 12),
        ("逃げ", 10),
        ("先行", 12),
        ("差し", 12),
        ("追込", 8),
    ]
    rows = "".join(
        f'<div><dt>{label}</dt><dd><span>'
        f'<img src="https://media.gametora.com/umamusume/ui/rank/simple/{icon:02d}.png">'
        "</span></dd></div>"
        for label, icon in labels
    )
    tree = html.fromstring(f"<main><dl>{rows}</dl></main>")

    assert GametoraTrainee._extract_aptitudes(tree) == {
        "surface": {"turf": AptitudeRank.A, "dirt": AptitudeRank.G},
        "distance": {
            "short": AptitudeRank.E,
            "mile": AptitudeRank.C,
            "medium": AptitudeRank.A,
            "long": AptitudeRank.A,
        },
        "strategy": {
            "front": AptitudeRank.B,
            "pace": AptitudeRank.A,
            "late": AptitudeRank.A,
            "end": AptitudeRank.C,
        },
    }
