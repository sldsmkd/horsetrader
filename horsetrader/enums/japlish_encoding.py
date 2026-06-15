from enum import Enum

from horsetrader.semantics import shuttle


@shuttle
class JaplishEncoding(Enum):
    JP = "jp"
    EN = "en"
