from pprint import pprint

from horsetrader.pipeline import Pipeline

if __name__ == "__main__":
    Pipeline().run()
    pprint(Pipeline().metrics)
