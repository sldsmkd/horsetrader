import sqlite3
from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.enums import Sources
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import SteamFile

logger = Logger.get(__name__)


@transcend
class UmamusumeSkills(metaclass=SingletonMeta):
    """Lossless skill rows from the installed Global client's master database."""

    def __init__(self):
        self._steam = SteamFile(client="global")

    def skills(self) -> Sequence[dict]:
        database = self._steam.database("master.mdb")
        connection = sqlite3.connect(f"{database.resolve().as_uri()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            rows = connection.execute(
                """
                SELECT skill_data.*,
                       name.text AS name_en,
                       description.text AS description_en
                  FROM skill_data
             LEFT JOIN text_data AS name
                    ON name.category = 47
                   AND name."index" = skill_data.id
             LEFT JOIN text_data AS description
                    ON description.category = 48
                   AND description."index" = skill_data.id
              ORDER BY skill_data.id
                """
            ).fetchall()
        finally:
            connection.close()

        if not rows:
            raise ValueError("Umamusume master.mdb: no skill_data rows found")

        records: list[dict] = []
        for row in rows:
            record = dict(row)
            skill_id = record["id"]
            if not record["name_en"] or not record["description_en"]:
                raise ValueError(
                    f"Umamusume master.mdb: skill {skill_id} has incomplete EN text"
                )
            record["key"] = f"skill-{skill_id}"
            record["correlations"] = {Sources.CYGAMES.value: skill_id}
            records.append(record)

        logger.info("Extracted %d skills from Umamusume master.mdb", len(records))
        return records
