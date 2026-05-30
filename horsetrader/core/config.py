from os import environ
from pathlib import Path
from sys import stderr

from dotenv import find_dotenv, load_dotenv

from horsetrader.semantics import tazuna

from .singleton_meta import SingletonMeta

_TARGET = "HORSETRADER_TARGET"
_SKIP_CACHE_REFRESH = "HORSETRADER_SKIP_CACHE_REFRESH"

_SKELETON = f"""\
# Horsetrader runtime configuration.
# Process env (shell exports) takes precedence over values here.

# Required: absolute path to the ETL output root.
{_TARGET}=

# Optional flags (uncomment to enable):
# {_SKIP_CACHE_REFRESH}=1
"""


@tazuna
class Config(metaclass=SingletonMeta):
    """Centralised runtime configuration sourced from environment variables.

    All horsetrader env vars are read through Config so call sites don't
    sprinkle ``environ.get`` lookups. On first construction, Config loads a
    ``.env`` file via ``python-dotenv`` (process env wins over file values);
    if no ``.env`` exists anywhere up the tree from CWD and the required
    ``HORSETRADER_TARGET`` isn't exported either, a skeleton ``.env`` is
    written to CWD as a first-run scaffold.

    Path-related state is validated lazily on first ``.cache`` / ``.site``
    access so import-time consumers (e.g. Logger) don't force every entry
    point to set the target dir.

    Recognised env vars:
      - ``HORSETRADER_TARGET`` — output root. Required; lazily validated.
      - ``HORSETRADER_SKIP_CACHE_REFRESH`` — bypass cache TTL checks. Truthy = any non-empty string.
    """

    def __init__(self):
        self._root: Path | None = None
        self._dotenv_path: Path | None = None
        self._repo_root: Path = self._find_repo_root()
        self._load_dotenv()

    @staticmethod
    def _find_repo_root() -> Path:
        current = Path(__file__).resolve().parent
        while current != current.parent:
            if (current / ".git").exists() or (current / ".env").exists():
                return current
            current = current.parent
        raise RuntimeError("Could not find repo root (.git or .env)")

    def _load_dotenv(self) -> None:
        found = find_dotenv(usecwd=True)
        if found:
            self._dotenv_path = Path(found)
            load_dotenv(self._dotenv_path, override=False)
            return
        if _TARGET in environ:
            return
        self._dotenv_path = Path.cwd() / ".env"
        self._dotenv_path.write_text(_SKELETON)
        print(
            f"Created skeleton {self._dotenv_path}. "
            f"Set {_TARGET} in it (or in your shell) and re-run.",
            file=stderr,
        )
        load_dotenv(self._dotenv_path, override=False)

    def _target(self) -> Path:
        if self._root is not None:
            return self._root
        value = environ.get(_TARGET)
        if not value:
            location = (
                f"in {self._dotenv_path}"
                if self._dotenv_path is not None
                else "in your shell or a .env file"
            )
            raise RuntimeError(
                f"{_TARGET} is not set. Set {_TARGET}=<path> {location}."
            )
        self._root = Path(value).expanduser().resolve()
        return self._root

    @property
    def cache(self) -> Path:
        """Path to the cache directory under the target, creating it if missing."""
        cache_dir = self._target() / ".cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir

    @property
    def site(self) -> Path:
        """Path to the site directory under the target, creating it if missing."""
        site_dir = self._target() / "site"
        site_dir.mkdir(parents=True, exist_ok=True)
        return site_dir

    @property
    def skip_cache_refresh(self) -> bool:
        """True if cache TTL checks should be bypassed. Re-read on each access."""
        return bool(environ.get(_SKIP_CACHE_REFRESH))

    @property
    def static(self) -> Path:
        """Path to the static / data directory in the ETL repo (hand-curated assets)."""
        return self._repo_root / "static"

    @property
    def static_yaml(self) -> Path:
        """Path to the consolidated static YAML corpus (``static/yaml/``).

        Every `*.yaml` here is auto-loaded and merged by the store — no
        whitelist. Reference-only / not-yet-wired files live in `static/pending/`
        instead, outside the loaded set.
        """
        return self.static / "yaml"

    @property
    def references(self) -> Path:
        """Path to the references directory in the ETL repo (hand-curated source assets)."""
        return self._repo_root / "references"
