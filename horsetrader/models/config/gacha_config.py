from dataclasses import dataclass

from horsetrader.enums import GachaDefaults, GachaRarityTier
from horsetrader.output._records import GachaConfig as GachaConfigRecord
from horsetrader.semantics import yayoi


@yayoi
@dataclass(frozen=True)
class GachaConfig:
    """Standing gacha rules used by planner-side pull math.

    This is game-economy data, so Yayoi owns the config object. The tunable
    constants live in ``horsetrader.enums.gacha``; Eishin only serialises the
    baked record into ``config.json``.
    """

    spark_threshold: int = GachaDefaults.SPARK_THRESHOLD.value
    carats_per_pull: int = GachaDefaults.CARATS_PER_PULL.value
    paid_daily_pull: int = GachaDefaults.PAID_DAILY_PULL.value
    rarity_rates: dict[str, float] | None = None
    featured_rates: dict[str, float] | None = None

    def effective_rarity_rates(self) -> dict[str, float]:
        return self.rarity_rates or {
            GachaRarityTier.CRYSTAL.value: GachaDefaults.CRYSTAL_RARITY_RATE.value,
            GachaRarityTier.GOLD.value: GachaDefaults.GOLD_RARITY_RATE.value,
            GachaRarityTier.SILVER.value: GachaDefaults.SILVER_RARITY_RATE.value,
        }

    def effective_featured_rates(self) -> dict[str, float]:
        return self.featured_rates or {
            GachaRarityTier.CRYSTAL.value: GachaDefaults.CRYSTAL_FEATURED_RATE.value,
            GachaRarityTier.GOLD.value: GachaDefaults.GOLD_FEATURED_RATE.value,
        }

    def bake(self) -> GachaConfigRecord:
        return GachaConfigRecord(
            spark_threshold=self.spark_threshold,
            carats_per_pull=self.carats_per_pull,
            paid_daily_pull=self.paid_daily_pull,
            rarity_rates=self.effective_rarity_rates(),
            featured_rates=self.effective_featured_rates(),
        )


def load_gacha_config() -> GachaConfig:
    """Build the singleton gacha config block for ``config.json``."""
    return GachaConfig()
