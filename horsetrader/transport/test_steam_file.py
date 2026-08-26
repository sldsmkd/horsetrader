from datetime import datetime, timedelta, timezone
from os import utime
from pathlib import Path

import pytest

from .steam_file import SteamFile


NOW = datetime(2026, 8, 9, 12, tzinfo=timezone.utc)


def _transport(
    tmp_path: Path,
    client: str = "global",
) -> tuple[SteamFile, Path]:

    steam = tmp_path / "steam"
    app_ids = {"global": 3224770, "jp": 3564400}
    game_data = (
        steam
        / f"steamapps/compatdata/{app_ids[client]}"
        / SteamFile._PROTON_GAME_DATA
    )
    game_data.mkdir(parents=True)
    config = tmp_path / "system.ini"
    config.write_text(
        "[steam]\n"
        f"install_locations =\n    {steam}\n\n"
        "[steam.global]\n"
        "app_id = 3224770\n\n"
        "[steam.jp]\n"
        "app_id = 3564400\n"
    )
    return SteamFile(config, tmp_path / "cache", client), game_data


def _make_stale(path: Path) -> None:
    timestamp = (NOW - timedelta(hours=25)).timestamp()
    utime(path, (timestamp, timestamp))


def test_database_copies_and_validates_source(tmp_path):
    transport, game_data = _transport(tmp_path)
    source = game_data / "master/master.mdb"
    source.parent.mkdir()
    source.write_bytes(b"current database")

    cached = transport.database("master.mdb", now=NOW)

    assert cached == tmp_path / "cache/global/master.mdb"
    assert cached.read_bytes() == source.read_bytes()
    assert SteamFile._md5(cached) == SteamFile._md5(source)


def test_fresh_database_does_not_consult_install(tmp_path):
    transport, game_data = _transport(tmp_path)
    cached = tmp_path / "cache/global/master.mdb"
    cached.parent.mkdir(parents=True)
    cached.write_bytes(b"cached")
    utime(cached, (NOW.timestamp(), NOW.timestamp()))

    assert transport.database("master.mdb", now=NOW).read_bytes() == b"cached"
    assert not (game_data / "master/master.mdb").exists()


def test_stale_unchanged_database_is_revalidated_without_copy(tmp_path):
    transport, game_data = _transport(tmp_path)
    source = game_data / "master/master.mdb"
    source.parent.mkdir()
    source.write_bytes(b"same database")
    cached = tmp_path / "cache/global/master.mdb"
    cached.parent.mkdir(parents=True)
    cached.write_bytes(source.read_bytes())
    _make_stale(cached)
    inode = cached.stat().st_ino

    assert transport.database("master.mdb", now=NOW) == cached
    assert cached.stat().st_ino == inode
    assert datetime.fromtimestamp(cached.stat().st_mtime, tz=timezone.utc) == NOW


def test_stale_changed_database_is_replaced(tmp_path):
    transport, game_data = _transport(tmp_path)
    source = game_data / "meta"
    source.write_bytes(b"new database")
    cached = tmp_path / "cache/global/meta"
    cached.parent.mkdir(parents=True)
    cached.write_bytes(b"old database")
    _make_stale(cached)

    assert transport.database("meta", now=NOW).read_bytes() == b"new database"


def test_unknown_database_fails_loud(tmp_path):
    transport, _ = _transport(tmp_path)

    with pytest.raises(ValueError, match="Unknown Umamusume database"):
        transport.database("other.mdb", now=NOW)


def test_jp_client_uses_its_own_app_id_and_cache_namespace(tmp_path):
    transport, game_data = _transport(tmp_path, client="jp")
    source = game_data / "master/master.mdb"
    source.parent.mkdir()
    source.write_bytes(b"jp database")

    cached = transport.database("master.mdb", now=NOW)

    assert transport.client == "jp"
    assert "compatdata/3564400" in str(game_data)
    assert cached == tmp_path / "cache/jp/master.mdb"
    assert cached.read_bytes() == b"jp database"
