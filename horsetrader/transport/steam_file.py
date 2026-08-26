from configparser import ConfigParser, Error as ConfigParserError
from datetime import datetime, timedelta, timezone
from hashlib import md5
from os import utime
from pathlib import Path
from shutil import copyfile
from tempfile import NamedTemporaryFile

from horsetrader.core import Config
from horsetrader.info import Logger, Metrics
from horsetrader.semantics import shakur

logger = Logger.get(__name__)


@shakur
class SteamFile:
    """Read-only access to Umamusume's downloaded Steam/Proton data.

    Callers receive private cache copies, never paths into the live game tree.
    A copy is trusted for 24 hours; after that its MD5 is compared with the
    installed file and it is either revalidated in place or replaced atomically.
    MD5 is deliberately only an equality check here, not a security boundary.
    """

    CACHE_TIME = timedelta(hours=24)
    DATABASES = {
        "master.mdb": Path("master/master.mdb"),
        "meta": Path("meta"),
    }
    _PROTON_GAME_DATA = Path(
        "pfx/drive_c/users/steamuser/AppData/LocalLow/Cygames/Umamusume"
    )

    def __init__(
        self,
        config_path: Path | None = None,
        cache_root: Path | None = None,
        client: str = "global",
    ):

        self._config_path = config_path or Config().system / "system.ini"
        self._client = client
        self._cache_directory = (cache_root or Config().cache / "databases") / client
        self._app_id, self._install_locations = self._read_config()

    def _read_config(self) -> tuple[int, tuple[Path, ...]]:
        parser = ConfigParser()
        if not parser.read(self._config_path):
            raise FileNotFoundError(
                f"Steam configuration not found: {self._config_path}"
            )
        if not parser.has_section("steam"):
            raise ValueError(f"{self._config_path}: missing [steam] section")

        client_section = f"steam.{self._client}"
        if not parser.has_section(client_section):
            raise ValueError(
                f"{self._config_path}: missing [{client_section}] section"
            )

        try:
            app_id = parser.getint(client_section, "app_id")
        except (ConfigParserError, ValueError) as exc:
            raise ValueError(
                f"{self._config_path}: invalid {client_section}.app_id"
            ) from exc

        locations = tuple(
            Path(line.strip())
            for line in parser.get(
                "steam", "install_locations", fallback=""
            ).splitlines()
            if line.strip()
        )
        if not locations:
            raise ValueError(f"{self._config_path}: steam.install_locations is empty")
        return app_id, locations

    @property
    def game_data_locations(self) -> tuple[Path, ...]:
        return tuple(
            location
            / "steamapps"
            / "compatdata"
            / str(self._app_id)
            / self._PROTON_GAME_DATA
            for location in self._install_locations
        )

    @property
    def client(self) -> str:
        return self._client

    def _source(self, relative_path: Path) -> Path:
        for game_data in self.game_data_locations:
            candidate = game_data / relative_path
            if candidate.is_file():
                return candidate
        searched = ", ".join(
            str(path / relative_path) for path in self.game_data_locations
        )
        raise FileNotFoundError(
            f"Steam file {relative_path} not found; searched {searched}"
        )

    @staticmethod
    def _md5(path: Path) -> str:
        digest = md5()
        with path.open("rb") as file:
            while chunk := file.read(1024 * 1024):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _is_fresh(path: Path, now: datetime) -> bool:
        modified_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        return now - modified_at <= SteamFile.CACHE_TIME

    def _replace(self, source: Path, cached: Path) -> None:
        self._cache_directory.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            dir=self._cache_directory,
            prefix=f".{cached.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary = Path(temporary_file.name)

        try:
            source_md5_before = self._md5(source)
            copyfile(source, temporary)
            source_md5_after = self._md5(source)
            cached_md5 = self._md5(temporary)
            if source_md5_before != source_md5_after or cached_md5 != source_md5_after:
                raise RuntimeError(f"Steam file changed while copying: {source}")
            temporary.replace(cached)
        finally:
            temporary.unlink(missing_ok=True)

    def database(self, name: str, now: datetime | None = None) -> Path:
        """Return a current private cache copy of one known client database."""
        if name not in self.DATABASES:
            raise ValueError(f"Unknown Umamusume database: {name}")
        if now is None:
            now = datetime.now(timezone.utc)
        if now.tzinfo is None:
            raise ValueError("now must be timezone-aware")

        cached = self._cache_directory / name
        if cached.is_file() and self._is_fresh(cached, now):
            logger.debug("STEAM CACHE HIT %s", cached)
            Metrics().incr("shakur.steam.cache.hit")
            return cached

        source = self._source(self.DATABASES[name])
        Metrics().incr("shakur.steam.cache.validate")
        if cached.is_file() and self._md5(cached) == self._md5(source):
            timestamp = now.timestamp()
            utime(cached, (timestamp, timestamp))
            logger.debug("STEAM CACHE VALID %s", cached)
            return cached

        Metrics().incr("shakur.steam.cache.copy")
        logger.debug("COPY %s -> %s", source, cached)
        self._replace(source, cached)
        timestamp = now.timestamp()
        utime(cached, (timestamp, timestamp))
        return cached

    def databases(self) -> dict[str, Path]:
        """Cache and return every database currently used by client extractors."""
        return {name: self.database(name) for name in self.DATABASES}
