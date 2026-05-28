from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from ethicrawl import Url
from PIL import Image as PillowImage

from horsetrader.enums import CacheTime
from horsetrader.models.core import References
from horsetrader.semantics import currenchan
from horsetrader.transport import UmaClient


@currenchan
@dataclass
class Image:
    """A picture, identified by where it currently lives.

    `url` is the canonical "current location" — it starts as the web URL Transcend
    extracted, then becomes the published umastagram link once Curren Chan posts.
    Image itself does not decide what that link is: `process(outfile=...)` writes
    pixels to disk and records dimensions, but leaves `url` untouched. The
    publisher (`CurrenChan.process`) finalises `url` to the site-relative path
    (e.g. `/img/characters/foo.webp`) so downstream serialisation doesn't need
    to strip a filesystem prefix.

    The original source URL is recorded on `references` before publish, so it
    survives the rewrite and can be folded into entity-level provenance.
    """

    url: Url | Path
    references: References = field(default_factory=References)

    def __post_init__(self):
        self._processed = False
        self._content: bytes | None = None
        self._width: int | None = None
        self._height: int | None = None

    @staticmethod
    def _pillow_format(suffix: str) -> str:
        fmt = suffix.lstrip(".").upper()
        return "JPEG" if fmt == "JPG" else fmt

    @staticmethod
    def _rescale(img, width: int):
        h = round(img.height * width / img.width)
        return img.resize((width, h), PillowImage.Resampling.LANCZOS)

    def process(self, outfile: Path | None = None, width: int | None = None) -> bool:
        if self._processed:
            if (
                outfile is not None
                and self._content is not None
                and not outfile.exists()
            ):
                self._save(self._content, outfile, width)
            return self._content is not None

        # Already-written outfile is the trusted cache: read dims, skip the fetch.
        if outfile is not None and outfile.exists():
            with PillowImage.open(outfile) as img:
                self._width, self._height = img.size
            self._processed = True
            return True

        content = self._fetch_content()
        if content is None:
            self._processed = True
            return False

        if outfile is not None:
            self._save(content, outfile, width)
        else:
            self._capture_dims(content, width)

        self._content = content
        self._processed = True
        return True

    def _fetch_content(self) -> bytes | None:
        """Resolve `self.url` to raw bytes, or None if the source is unavailable.

        file:// URLs read from disk via the shared cache (keyed by hashed path)
        so repeated runs skip the disk read. HTTP/HTTPS delegates to Shakur's
        `UmaClient.try_get`, which owns the cache, the 404→sentinel write, and
        the sentinel short-circuit so we don't re-hit missing URLs.
        """
        if isinstance(self.url, Url) and self.url.scheme == "file":
            from horsetrader.transport.uma_client_cache import UmaClientCache
            cached = UmaClientCache.read(self.url, max_age=None)
            if cached is not None:
                return cached if isinstance(cached, bytes) else cached.encode()
            content = Path(self.url.path).read_bytes()
            UmaClientCache.write(self.url, content)
            return content

        content = UmaClient().try_get(self.url, cache=CacheTime.BINARY)
        if content is None:
            return None
        if not isinstance(content, bytes):
            raise RuntimeError(f"Expected binary content for image {self.url}")
        return content

    def _save(self, content: bytes, outfile: Path, width: int | None) -> None:
        """Write `content` to `outfile` (with optional rescale), capturing the
        final on-disk dimensions. Does not touch `self.url` — the publisher
        decides what URL the image is presented as (see class docstring).
        """
        outfile.parent.mkdir(parents=True, exist_ok=True)
        with PillowImage.open(BytesIO(content)) as img:
            if width is not None:
                img = self._rescale(img, width)
            self._width, self._height = img.size
            img.save(outfile, format=self._pillow_format(outfile.suffix))

    def _capture_dims(self, content: bytes, width: int | None) -> None:
        with PillowImage.open(BytesIO(content)) as img:
            if width is not None:
                img = self._rescale(img, width)
            self._width, self._height = img.size

    def processed(self) -> bool:
        return self._processed

    def __repr__(self) -> str:
        if self._processed and self._width is not None:
            return f"Image(url={str(self.url)!r}, size={self._width}x{self._height})"
        return f"Image(url={str(self.url)!r})"

    def height(self) -> int | None:
        if not self._processed:
            raise ValueError("Image must be processed before retrieving dimensions")
        return self._height

    def width(self) -> int | None:
        if not self._processed:
            raise ValueError("Image must be processed before retrieving dimensions")
        return self._width
