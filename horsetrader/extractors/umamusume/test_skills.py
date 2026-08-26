import sqlite3

import pytest

from horsetrader.core import SingletonMeta

from .skills import UmamusumeSkills


@pytest.fixture(autouse=True)
def reset_singletons():
    SingletonMeta.reset()
    yield
    SingletonMeta.reset()


def _database(tmp_path):
    database = tmp_path / "master.mdb"
    connection = sqlite3.connect(database)
    connection.executescript(
        """
        CREATE TABLE skill_data (
            id INTEGER PRIMARY KEY,
            rarity INTEGER NOT NULL,
            group_id INTEGER NOT NULL
        );
        CREATE TABLE text_data (
            id INTEGER NOT NULL,
            category INTEGER NOT NULL,
            "index" INTEGER NOT NULL,
            text TEXT NOT NULL,
            PRIMARY KEY (category, "index")
        );
        INSERT INTO skill_data VALUES (200431, 2, 20043);
        INSERT INTO text_data VALUES (1, 47, 200431, 'Concentration');
        INSERT INTO text_data VALUES (
            2,
            48,
            200431,
            'Decrease time lost to slow starts.'
        );
        """
    )
    connection.close()
    return database


def test_skills_preserve_client_columns_and_add_project_identity(tmp_path, monkeypatch):
    database = _database(tmp_path)
    monkeypatch.setattr(
        "horsetrader.extractors.umamusume.skills.SteamFile.database",
        lambda _self, _name: database,
    )

    assert UmamusumeSkills().skills() == [
        {
            "id": 200431,
            "rarity": 2,
            "group_id": 20043,
            "name_en": "Concentration",
            "description_en": "Decrease time lost to slow starts.",
            "key": "skill-200431",
            "correlations": {"cygames": 200431},
        }
    ]


def test_skills_fail_loud_when_localized_text_is_missing(tmp_path, monkeypatch):
    database = _database(tmp_path)
    connection = sqlite3.connect(database)
    connection.execute("DELETE FROM text_data WHERE category = 48")
    connection.commit()
    connection.close()
    monkeypatch.setattr(
        "horsetrader.extractors.umamusume.skills.SteamFile.database",
        lambda _self, _name: database,
    )

    with pytest.raises(ValueError, match="skill 200431 has incomplete EN text"):
        UmamusumeSkills().skills()
