from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from ethicrawl import Resource, ResourceList, Url

from horsetrader.core import Config
from horsetrader.info import Logger
from horsetrader.semantics import currenchan

from .image import Image

logger = Logger.get(__name__)


@currenchan
@dataclass
class ImageRequest(Resource):
    """A URL plus the on-disk destination Digitan wants Curren Chan to write to."""

    outfile: Path
    width: int | None = None


@currenchan
class CurrenChan:
    """Curren Chan turns URLs into "nice things to post on Umstagram".

    Digitan hands her a ResourceList of ImageRequests, and she sorts them by
    hostname (so ethicrawl doesn't have to rebind robots.txt / session state
    mid-batch) then dispatches each one to ``Image.process``.

    Returns a dict keyed by the original URL string so the caller can look up
    the processed (or failed-to-process) Image by URL.
    """

    def process(
        self,
        requests: ResourceList[ImageRequest],
    ) -> dict[str, Image | None]:
        groups: dict[str, list[ImageRequest]] = defaultdict(list)
        for req in requests:
            key = req.url.hostname if req.url.scheme in ("http", "https") else ""
            groups[key].append(req)

        results: dict[str, Image | None] = {}
        for host, group in groups.items():
            label = host or "local"
            logger.info(f"Processing {len(group)} image(s) from {label}")
            for req in group:
                results[str(req.url)] = self._process_one(req.url, req.outfile, req.width)
        return results

    def _process_one(
        self,
        source: Url,
        outfile: Path,
        width: int | None = None,
    ) -> Image | None:
        site_root = Config().static
        image = Image(source)
        # Curren Chan: "I got this from here!" — stamp the source on the
        # Image so the owning entity can fold it into provenance once
        # `image.url` is finalised to the published umastagram link.
        image.references.add(str(source))
        try:
            ok = image.process(outfile=outfile, width=width)
        except Exception as exc:
            logger.warning(f"Failed to process {source}: {exc}")
            return None
        if ok:
            # Publish: rewrite the url to the site-relative path the web
            # side will serve (e.g. `/img/characters/foo.webp`), so
            # downstream serialisers don't have to strip a filesystem prefix.
            image.url = Path("/") / outfile.relative_to(site_root)
            return image
        return None
