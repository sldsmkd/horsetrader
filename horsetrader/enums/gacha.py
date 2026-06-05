from enum import Enum


class GachaRarityTier(Enum):
    CRYSTAL = "crystal"
    GOLD = "gold"
    SILVER = "silver"


class GachaDefaults(Enum):
    SPARK_THRESHOLD = 200
    CARATS_PER_PULL = 150
    PAID_DAILY_PULL = 50
    CRYSTAL_RARITY_RATE = 0.03
    GOLD_RARITY_RATE = 0.18
    SILVER_RARITY_RATE = 0.79
    CRYSTAL_FEATURED_RATE = 0.0075
    GOLD_FEATURED_RATE = 0.0225
