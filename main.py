from json import dumps as json_dumps

from horsetrader.pipeline import Pipeline
from horsetrader.models.entities import Trainees, Trainees  # , Support, Supports

if __name__ == "__main__":
    # print(json_dumps(Pipeline().metrics, indent=2))

    Pipeline().write()
