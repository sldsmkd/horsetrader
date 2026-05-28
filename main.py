import json

from horsetrader.pipeline import Pipeline
from horsetrader.models.events import Scenarios

if __name__ == "__main__":
    Pipeline().run()
    print(json.dumps(Pipeline().metrics, indent=2))
