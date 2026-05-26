from abc import ABCMeta
from typing import Any

from horsetrader.semantics import tazuna


@tazuna
class SingletonMeta(ABCMeta):
    _instances: dict[type[Any], Any] = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]

    def reset(cls: type[Any] | None = None):
        """Reset singleton instances.

        - Called on a singleton class (e.g. ``Timeline.reset()``): reset only
          that class instance.
        - Called on the metaclass (``SingletonMeta.reset()``): reset all
          singleton instances.
        """
        if cls is None or cls is SingletonMeta:
            SingletonMeta._instances.clear()
            return
        cls._instances.pop(cls, None)
