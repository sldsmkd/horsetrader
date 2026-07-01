from enum import Enum
from typing import TYPE_CHECKING

from horsetrader.semantics import shuttle


if TYPE_CHECKING:
    from horsetrader.core import Japlish

_COSTUME_VARIANT_EN_MAP = {
    "DEFAULT": "Original",
    "ANIME_COLLAB": "Anime Collab",
    "AUTUMN_FESTIVAL": "Festival",
    "AUTUMN": "Autumn",
    "BEYOND_DREAMS": "Beyond Dreams",
    "BLAZE": "Blaze",
    "CAMP": "Camping",
    "CHAMBARA": "Warfare",
    "CHEERLEADER": "Cheerleader",
    "CHRISTMAS": "Christmas",
    "DESERTED_ISLAND": "Deserted Island",
    "FANTASY": "Fantasy",
    "FULL_ARMOR": "Full Armor",
    "GRAND_LIVE": "Grand Live",
    "GREAT_HARVEST_FESTIVAL": "Great Food Festival",
    "HALLOWEEN": "Halloween",
    "HOT_SPRING": "Onsen",
    "MASQUERADE": "Ballroom",
    "MECHA": "Mecha",
    "NEW_OUTFIT": "Alt Version",
    "NEW_YEAR": "New Year",
    "PARADE": "Parade",
    "PROJECT_LARC": "Project L'Arc",
    "SPORTS_FESTIVAL": "Sports Festival",
    "STEAMPUNK": "Steampunk",
    "SUMMER_WALK": "Summer Trip",
    "SUMMER": "Summer",
    "SUPREME_COMMANDER": "Supreme Commander",
    "THE_TWINKLE_LEGENDS": "The Twinkle Legends",
    "TRACEN_KEN": "Tracen-ken",
    "UAF": "U.A.F.",
    "VALENTINE": "Valentine",
    "WEDDING": "Wedding",
}

_COSTUME_VARIANT_JP_MAP = {
    "DEFAULT": "デフォルト",
    "NEW_YEAR": "新年",
    "HALLOWEEN": "ハロウィン",
    "MASQUERADE": "舞踏会",
    "VALENTINE": "バレンタイン",
    "CHRISTMAS": "クリスマス",
    "WEDDING": "ウエディング",
    "SUMMER": "夏",
    "AUTUMN_FESTIVAL": "秋祭り",
    "CHEERLEADER": "応援団",
    "ANIME_COLLAB": "アニメコラボ",
    "NEW_OUTFIT": "新衣装",
    "SUMMER_WALK": "サマーウォーク",
    "HOT_SPRING": "温泉",
    "DESERTED_ISLAND": "無人島へ",
    "PARADE": "パレード",
    "MECHA": "メカ",
    "AUTUMN": "秋",
    "CHAMBARA": "チャンバラ",
    "PROJECT_LARC": "プロジェクトL'Arc",
    "SPORTS_FESTIVAL": "体育祭",
    "STEAMPUNK": "スチームパンク",
    "CAMP": "キャンプ",
    "FANTASY": "ファンタジー",
    "BEYOND_DREAMS": "Beyond Dreams",
    "THE_TWINKLE_LEGENDS": "The Twinkle Legends",
    "TRACEN_KEN": "トレセン軒",
    "GREAT_HARVEST_FESTIVAL": "大豊食祭",
    "UAF": "U.A.F.",
    "BLAZE": "Blaze",
    "GRAND_LIVE": "グランドライブ",
    "SUPREME_COMMANDER": "総大将",
    "FULL_ARMOR": "フルアーマー",
}

@shuttle
class CostumeVariants(Enum):
    DEFAULT = "default"
    NEW_YEAR = "new-year"
    HALLOWEEN = "halloween"
    MASQUERADE = "masquerade"
    VALENTINE = "valentine"
    CHRISTMAS = "christmas"
    WEDDING = "wedding"
    SUMMER = "summer"
    AUTUMN_FESTIVAL = "autumn-festival"
    CHEERLEADER = "cheerleader"
    ANIME_COLLAB = "anime-collab"
    NEW_OUTFIT = "new-outfit"
    SUMMER_WALK = "summer-walk"
    HOT_SPRING = "hot-spring"
    DESERTED_ISLAND = "deserted-island"
    PARADE = "parade"
    MECHA = "mecha"
    AUTUMN = "autumn"
    CHAMBARA = "chambara"
    PROJECT_LARC = "project-larc"
    SPORTS_FESTIVAL = "sports-festival"
    STEAMPUNK = "steampunk"
    CAMP = "camp"
    FANTASY = "fantasy"
    BEYOND_DREAMS = "beyond-dreams"
    THE_TWINKLE_LEGENDS = "the-twinkle-legends"
    TRACEN_KEN = "tracen-ken"
    GREAT_HARVEST_FESTIVAL = "great-harvest-festival"
    UAF = "uaf"
    BLAZE = "blaze"
    GRAND_LIVE = "grand-live"
    SUPREME_COMMANDER = "supreme-commander"
    FULL_ARMOR = "full-armor"

    @property
    def en(self) -> "Japlish":
        from horsetrader.core import Japlish

        mapped = _COSTUME_VARIANT_EN_MAP.get(self.name, self.value)
        return Japlish(mapped, encoding="en")

    @property
    def jp(self) -> "Japlish":
        from horsetrader.core import Japlish

        mapped = _COSTUME_VARIANT_JP_MAP.get(self.name, self.value)
        return Japlish(mapped, encoding="jp")

    @classmethod
    def from_jp(cls, text: str) -> "CostumeVariants | None":
        """Resolve a JP badge string (e.g. "クリスマス") to its variant."""
        return _JP_TO_VARIANT.get(text)

    @classmethod
    def from_en(cls, text: str) -> "CostumeVariants | None":
        """Resolve an EN descriptor string (e.g. "Christmas") to its variant."""
        return _EN_TO_VARIANT.get(text)

    def match(self, query: str) -> bool:
        """True if query matches this variant's slug, enum name, or localized text."""
        needle = query.lower()
        if needle in self.value.lower() or needle in self.name.lower():
            return True
        return needle in str(self.jp).lower() or needle in str(self.en).lower()


_JP_TO_VARIANT = {jp: CostumeVariants[name] for name, jp in _COSTUME_VARIANT_JP_MAP.items()}
assert len(_JP_TO_VARIANT) == len(_COSTUME_VARIANT_JP_MAP), (
    "Duplicate JP value in _COSTUME_VARIANT_JP_MAP — last definition silently wins"
)

_EN_TO_VARIANT = {en: CostumeVariants[name] for name, en in _COSTUME_VARIANT_EN_MAP.items()}
assert len(_EN_TO_VARIANT) == len(_COSTUME_VARIANT_EN_MAP), (
    "Duplicate EN value in _COSTUME_VARIANT_EN_MAP — last definition silently wins"
)
