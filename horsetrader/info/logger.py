from logging import Logger as loggingLogger
from logging import getLogger, setLoggerClass

from horsetrader.semantics import spechan


class _FatalLogger(loggingLogger):
    """Logger whose ``error``/``critical`` calls log normally then SystemExit(1)."""

    def error(self, *args, **kwargs) -> None:
        super().error(*args, **kwargs)
        raise SystemExit(1)

    def critical(self, *args, **kwargs) -> None:
        super().critical(*args, **kwargs)
        raise SystemExit(1)


setLoggerClass(_FatalLogger)


@spechan
class Logger:
    @staticmethod
    def get(name: str | None = None) -> loggingLogger:
        return getLogger(name or "horsetrader")
