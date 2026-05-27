from enum import Enum


class SupportRarity(Enum):
    UNKNOWN = "unknown"
    R = "r"
    SR = "sr"
    SSR = "ssr"

    def rank(self) -> int:
        return {self.SSR: 0, self.SR: 1, self.R: 2, self.UNKNOWN: 3}[self]
