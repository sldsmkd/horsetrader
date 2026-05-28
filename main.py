import json
from pprint import pprint

from horsetrader.pipeline import Pipeline
from horsetrader.models.events import Stories

if __name__ == "__main__":
    # Pipeline().run()
    # print(json.dumps(Pipeline().metrics, indent=2))

    spe_stories = Stories().search("Special Week")
    for s in spe_stories:
        pprint(s.title.en if s.title else None)

# "Dashing towards Your Dreams"
# "Beaches, Bathing Suits & Blazing Trails"
# "Flying Run-Up!"
# "Happy New Future: Bonds Dyed in the Sunrise"
# "Together with Everyone"
