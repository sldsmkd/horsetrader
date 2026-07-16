from pprint import pprint

from horsetrader.info import DEBUG, INFO, WARNING, Logger
from horsetrader.pipeline import Pipeline

if __name__ == "__main__":
    Logger.get().setLevel(INFO)
    Pipeline().run()
    pprint(Pipeline().metrics)
