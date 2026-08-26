from os import environ
from pathlib import Path
from sys import stderr

from dotenv import find_dotenv, load_dotenv

from horsetrader.semantics import tazuna

from .singleton_meta import SingletonMeta

_SKIP_CACHE_REFRESH = "HORSETRADER_SKIP_CACHE_REFRESH"

_SKELETON = f"""\
# Horsetrader runtime configuration.
# Process env (shell exports) takes precedence over values here.

# Optional flags (uncomment to enable):
# {_SKIP_CACHE_REFRESH}=1
"""


@tazuna
class Config(metaclass=SingletonMeta):
    """Centralised runtime configuration sourced from environment variables.

    All horsetrader env vars are read through Config so call sites don't
    sprinkle ``environ.get`` lookups. On first construction, Config loads a
    ``.env`` file via ``python-dotenv`` (process env wins over file values);
    if no ``.env`` exists anywhere up the tree from CWD a skeleton ``.env``
    is written to CWD as a first-run scaffold.

    Recognised env vars:
      - ``HORSETRADER_SKIP_CACHE_REFRESH`` — bypass cache TTL checks. Truthy = any non-empty string.
    """

    def __init__(self):
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
        self._dotenv_path = Path.cwd() / ".env"
        self._dotenv_path.write_text(_SKELETON)
        print(f"Created skeleton {self._dotenv_path}.", file=stderr)
        load_dotenv(self._dotenv_path, override=False)

    @property
    def cache(self) -> Path:
        """Path to the cache directory at the repo root, creating it if missing."""
        cache_dir = self._repo_root / ".cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir

    @property
    def static(self) -> Path:
        """Path to the static deploy dir (``static/`` at the repo root), creating it if missing.

        The ETL bakes its shippable output here: the JSON bundle under
        ``static/json/`` and webp under ``static/img/``. This is the deploy root
        wrangler ships.
        """
        static_dir = self._repo_root / "static"
        static_dir.mkdir(parents=True, exist_ok=True)
        return static_dir

    @property
    def skip_cache_refresh(self) -> bool:
        """True if cache TTL checks should be bypassed. Re-read on each access."""
        return bool(environ.get(_SKIP_CACHE_REFRESH))

    @property
    def curated(self) -> Path:
        """Path to the curated config / data directory in the repo (``config/``, hand-curated assets)."""
        return self._repo_root / "config"

    @property
    def curated_yaml(self) -> Path:
        """Path to the consolidated curated YAML corpus (``config/yaml/``).

        Every `*.yaml` here is auto-loaded and merged by the store — no
        whitelist. Reference-only / not-yet-wired files live in `config/pending/`
        instead, outside the loaded set.
        """
        return self.curated / "yaml"

    @property
    def system(self) -> Path:
        """Path to tracked machine/source configuration (``config/system/``)."""
        return self.curated / "system"

    @property
    def schema(self) -> Path:
        """Path to the generated JSON-schema dir (``config/schema/``), creating it if missing.

        The bake writes ``academy.schema.json`` / ``events.schema.json`` here —
        out of the shippable ``static/`` deploy dir, since the schema isn't shipped
        (it's the contract the site's ``gen:types`` consumes).
        """
        schema_dir = self.curated / "schema"
        schema_dir.mkdir(parents=True, exist_ok=True)
        return schema_dir
