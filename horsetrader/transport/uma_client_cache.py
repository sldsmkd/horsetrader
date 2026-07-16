from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

from ethicrawl import Url

from horsetrader.core import Config
from horsetrader.semantics import shakur


@dataclass(frozen=True)
class CacheEntry:
    content: str | bytes
    modified_at: datetime


@shakur
class UmaClientCache:
    _BINARY_EXTENSIONS = {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ico",
        ".bmp",
        ".svg",
        ".pdf",
        ".zip",
    }

    _BINARY_MIME_TYPES = {
        "application/octet-stream",
        "application/pdf",
        "application/zip",
    }

    _TEXT_MIME_TO_EXTENSION = {
        "text/html": "html",
        "text/plain": "txt",
        "text/css": "css",
        "text/javascript": "js",
        "application/javascript": "js",
        "application/json": "json",
        "application/ld+json": "json",
        "application/xml": "xml",
        "text/xml": "xml",
    }

    _BINARY_MIME_TO_EXTENSION = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "image/x-icon": "ico",
        "image/bmp": "bmp",
        "application/pdf": "pdf",
        "application/zip": "zip",
    }

    @staticmethod
    def _normalized_mime(mime_type: str | None) -> str | None:
        if not mime_type:
            return None
        return mime_type.split(";", 1)[0].strip().lower() or None

    @staticmethod
    def _is_binary_mime(mime_type: str | None) -> bool | None:
        _mime = UmaClientCache._normalized_mime(mime_type)
        if _mime is None:
            return None
        if _mime.startswith("text/"):
            return False
        if (
            _mime.startswith("image/")
            or _mime.startswith("audio/")
            or _mime.startswith("video/")
            or _mime.startswith("font/")
            or _mime in UmaClientCache._BINARY_MIME_TYPES
        ):
            return True
        if _mime in UmaClientCache._TEXT_MIME_TO_EXTENSION:
            return False
        return None

    @staticmethod
    def _extension_from_mime(mime_type: str | None) -> str | None:
        _mime = UmaClientCache._normalized_mime(mime_type)
        if _mime is None:
            return None
        _text_ext = UmaClientCache._TEXT_MIME_TO_EXTENSION.get(_mime)
        if _text_ext is not None:
            return _text_ext
        _binary_ext = UmaClientCache._BINARY_MIME_TO_EXTENSION.get(_mime)
        if _binary_ext is not None:
            return _binary_ext
        return None

    @staticmethod
    def _cache_key(url: Url) -> tuple[Path, str]:
        _hash = sha256(str(url).encode("utf-8")).hexdigest()
        _selector = _hash[:2]
        _directory = Config().cache / _selector
        return _directory, _hash

    @staticmethod
    def _existing_cache_paths(url: Url) -> list[Path]:
        _directory, _hash = UmaClientCache._cache_key(url)
        if not _directory.exists():
            return []
        return sorted(
            (p for p in _directory.glob(f"{_hash}.*") if p.suffix != ".404"),
            key=lambda p: p.stat().st_mtime,
        )

    @staticmethod
    def _is_binary_cache_file(cache_path: Path) -> bool:
        return cache_path.suffix.lower() in UmaClientCache._BINARY_EXTENSIONS.union(
            {".bin"}
        )

    @staticmethod
    def is_binary(url: Url, mime_type: str | None = None) -> bool:
        _is_binary_from_mime = UmaClientCache._is_binary_mime(mime_type)
        if _is_binary_from_mime is not None:
            return _is_binary_from_mime

        return any(
            str(url).lower().endswith(ext) for ext in UmaClientCache._BINARY_EXTENSIONS
        )

    @staticmethod
    def content_label(url: Url, mime_type: str | None = None) -> str:
        """Coarse content-type bucket for metrics: the file extension this URL maps
        to. Prefers the response ``mime_type`` (the Content-Type header); falls back
        to the extension of the cache file already on disk — so a cache hit, which
        carries no header, still classifies — and ``"unknown"`` if neither resolves.
        Header and disk paths share the one vocabulary (the mime↔extension maps)."""
        _ext = UmaClientCache._extension_from_mime(mime_type)
        if _ext is not None:
            return _ext
        _existing = UmaClientCache._existing_cache_paths(url)
        if _existing:
            return _existing[-1].suffix.lstrip(".").lower() or "unknown"
        return "unknown"

    @staticmethod
    def cache_path(url: Url, mime_type: str | None = None):
        _path = url.path.lower()
        _is_binary = UmaClientCache.is_binary(url, mime_type=mime_type)
        _has_file_extension = "." in _path.rsplit("/", 1)[-1]
        _extension_from_mime = UmaClientCache._extension_from_mime(mime_type)
        _extension = (
            _path.rsplit(".", 1)[-1]
            if _has_file_extension
            else (
                _extension_from_mime
                if _extension_from_mime is not None
                else ("bin" if _is_binary else "html")
            )
        )

        _directory, _hash = UmaClientCache._cache_key(url)
        return _directory / f"{_hash}.{_extension}"

    @staticmethod
    def read_entry(url: Url, max_age: timedelta | None = None) -> CacheEntry | None:
        _existing = UmaClientCache._existing_cache_paths(url)
        _cache_path = _existing[-1] if _existing else UmaClientCache.cache_path(url)
        if not _cache_path.exists():
            return None
        _modified_at = datetime.fromtimestamp(
            _cache_path.stat().st_mtime,
            tz=timezone.utc,
        )
        if max_age is not None:
            if (datetime.now(timezone.utc) - _modified_at) > max_age:
                return None
        with _cache_path.open("rb") as f:
            _cached = f.read()
        return CacheEntry(
            content=(
                _cached
                if UmaClientCache._is_binary_cache_file(_cache_path)
                else _cached.decode("utf-8", errors="replace")
            ),
            modified_at=_modified_at,
        )

    @staticmethod
    def read(url: Url, max_age: timedelta | None = None) -> str | bytes | None:
        _entry = UmaClientCache.read_entry(url, max_age=max_age)
        return _entry.content if _entry is not None else None

    @staticmethod
    def write(url: Url, content: bytes, mime_type: str | None = None) -> None:
        _cache_path = UmaClientCache.cache_path(url, mime_type=mime_type)
        _cache_path.parent.mkdir(parents=True, exist_ok=True)

        # Keep a single cache file per URL hash by removing stale extension variants.
        for _existing in UmaClientCache._existing_cache_paths(url):
            if _existing != _cache_path:
                _existing.unlink(missing_ok=True)

        with _cache_path.open("wb") as f:
            f.write(content)

    @staticmethod
    def _sentinel_path(url: Url) -> Path:
        _directory, _hash = UmaClientCache._cache_key(url)
        return _directory / f"{_hash}.404"

    @staticmethod
    def write_sentinel(url: Url) -> None:
        _path = UmaClientCache._sentinel_path(url)
        _path.parent.mkdir(parents=True, exist_ok=True)
        _path.touch()

    @staticmethod
    def is_sentinel(url: Url, max_age: timedelta | None = None) -> bool:
        _path = UmaClientCache._sentinel_path(url)
        if not _path.exists():
            return False
        if max_age is not None:
            _modified_at = datetime.fromtimestamp(_path.stat().st_mtime)
            if (datetime.now() - _modified_at) > max_age:
                return False
        return True

    @staticmethod
    def flush(url: Url) -> bool:
        _deleted = False
        for _cache_path in UmaClientCache._existing_cache_paths(url):
            _cache_path.unlink(missing_ok=True)
            _deleted = True

        if _deleted:
            return True

        _cache_path = UmaClientCache.cache_path(url)
        if not _cache_path.exists():
            return False
        _cache_path.unlink()
        return True
