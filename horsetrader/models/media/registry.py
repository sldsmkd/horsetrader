from horsetrader.core import SingletonMeta
from horsetrader.semantics import currenchan


@currenchan
class ImageRegistry(metaclass=SingletonMeta):
    """Curren Chan's ledger of every published image's intrinsic dimensions.

    As she publishes each image (rewrites its url to the site-relative path and
    has its on-disk size in hand), Curren Chan records ``published-url → (w, h)``
    here. Eishin bakes the whole map to ``images.json`` so the front-end can stamp
    explicit ``width``/``height`` on every ``<img>`` — killing the class of
    layout bugs where a percentage-width image falls back to its intrinsic size
    under a ``max-content`` pass (Godolphin F10), and reserving space against
    layout shift.

    A singleton (like ``Metrics``) so every ``CurrenChan().process(...)`` call in
    a run writes into one store; ``clear()`` empties it in place for a fresh run.
    Keyed by the published url string — the same string the bundle serialises as
    each image field — so the front-end broker resolves dims by url with no
    separate identity.
    """

    def __init__(self) -> None:
        self._dims: dict[str, tuple[int, int]] = {}

    def record(self, url: str, width: int, height: int) -> None:
        self._dims[url] = (width, height)

    def entries(self) -> dict[str, tuple[int, int]]:
        return dict(self._dims)

    def clear(self) -> None:
        self._dims.clear()
