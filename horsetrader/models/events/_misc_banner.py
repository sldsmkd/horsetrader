from ethicrawl import ResourceList, Url

from horsetrader.core import Config
from horsetrader.extractors.static import Static
from horsetrader.models.media import CurrenChan, Image, ImageRequest


def process_misc_banner(filename: str) -> Image | None:
    """Publish a curated misc banner image and return its site-relative Image."""
    path = Static().misc_image(filename)
    if path is None:
        return None

    url = Url(path.as_uri())
    outfile = Config().static / "img" / "misc" / f"{path.stem}.webp"
    requests: ResourceList[ImageRequest] = ResourceList(
        [ImageRequest(url=url, outfile=outfile)]
    )
    return CurrenChan().process(requests).get(str(url))
