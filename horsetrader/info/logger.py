from functools import wraps
from logging import Logger as loggingLogger
from logging import getLogger, INFO, DEBUG, WARNING, ERROR, CRITICAL

from horsetrader.core import Config
from horsetrader.semantics import spechan


@spechan
class Logger:
    _FATAL_ERROR_HOOK_INSTALLED_ATTR = "_horsetrader_fatal_error_hook_installed"

    @staticmethod
    def _install_fatal_error_hook(logger: loggingLogger) -> None:
        if getattr(logger, Logger._FATAL_ERROR_HOOK_INSTALLED_ATTR, False):
            return

        original_error = logger.error

        @wraps(original_error)
        def fatal_error(*args, **kwargs):
            original_error(*args, **kwargs)
            raise SystemExit(1)

        logger.error = fatal_error  # type: ignore[assignment]
        setattr(logger, Logger._FATAL_ERROR_HOOK_INSTALLED_ATTR, True)

    @staticmethod
    def get(name: str | None = None) -> loggingLogger:
        logger = getLogger(name or "horsetrader")
        if Config().exit_on_error:
            Logger._install_fatal_error_hook(logger)
        return logger
