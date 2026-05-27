from json import dumps as json_dumps

from horsetrader.pipeline import Pipeline
from horsetrader.models.events import Banner, Banners

if __name__ == "__main__":

    summer_banners = Banners().search("summer")

    for banner in summer_banners:
        print(banner.key, banner.contents[-1])

    Pipeline().write()
    print(json_dumps(Pipeline().metrics, indent=2))
