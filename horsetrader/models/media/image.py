from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from ethicrawl import Url
from PIL import Image as PillowImage

from horsetrader.enums import CacheTime
from horsetrader.semantics import currenchan
from horsetrader.transport import UmaClient, UmaClientCache


@currenchan
@dataclass
class Image:
    url: Url | Path

    def __post_init__(self):
        self._processed = False
        self._content: bytes | None = None
        self._width: int | None = None
        self._height: int | None = None

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
                outfile.parent.mkdir(parents=True, exist_ok=True)
                fmt = outfile.suffix.lstrip(".").upper()
                if fmt == "JPG":
                    fmt = "JPEG"
                with PillowImage.open(BytesIO(self._content)) as img:
                    if width is not None:
                        img = self._rescale(img, width)
                    img.save(outfile, format=fmt)
                self.url = outfile
            return self._content is not None

        if outfile is not None and outfile.exists():
            with PillowImage.open(outfile) as img:
                self._width, self._height = img.size
            self._processed = True
            self.url = outfile
            return True

        if isinstance(self.url, Path):
            with PillowImage.open(self.url) as img:
                if width is not None:
                    img = self._rescale(img, width)
                self._width, self._height = img.size
                if outfile is not None and not outfile.exists():
                    outfile.parent.mkdir(parents=True, exist_ok=True)
                    fmt = outfile.suffix.lstrip(".").upper()
                    if fmt == "JPG":
                        fmt = "JPEG"
                    img.save(outfile, format=fmt)
            self._processed = True
            if outfile is not None:
                self.url = outfile
            return True

        if UmaClientCache.is_sentinel(self.url, max_age=CacheTime.SENTINEL.value):
            self._processed = True
            return False

        try:
            content = UmaClient().get(self.url, cache=CacheTime.BINARY)
        except RuntimeError as exc:
            if ": 404" in str(exc):
                UmaClientCache.write_sentinel(self.url)
                self._processed = True
                return False
            raise
        if not isinstance(content, bytes):
            raise RuntimeError(f"Expected binary content for image {self.url}")
        with PillowImage.open(BytesIO(content)) as img:
            if width is not None:
                img = self._rescale(img, width)
            self._width, self._height = img.size
            if outfile is not None and not outfile.exists():
                outfile.parent.mkdir(parents=True, exist_ok=True)
                fmt = outfile.suffix.lstrip(".").upper()
                if fmt == "JPG":
                    fmt = "JPEG"
                img.save(outfile, format=fmt)
        self._content = content
        self._processed = True
        if outfile is not None:
            self.url = outfile
        return True

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
