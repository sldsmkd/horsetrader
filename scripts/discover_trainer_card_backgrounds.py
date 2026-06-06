#!/usr/bin/env python3
"""Probe Gametora trainer-card background URLs and write discovered entries.

This is a discovery helper, not ETL. It politely checks the predictable
``/bg/landscape/<location>_<variant>.jpg`` grid and appends a YAML-ish catalog
entry for every URL that does not 404. For each location it probes variants from
``00`` upward and moves to the next location on the first missing variant. There
appear to be about 180 total variants; pass ``--expect-found 180`` to validate
that count after the probe completes. Use ``--start-location`` and ``--append``
to resume a partial pass without overwriting annotated output. Copy confirmed entries into
``config/yaml/trainer_card_backgrounds.yaml`` once labels are settled.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_PATTERN = "https://media.gametora.com/umamusume/bg/landscape/{location:04d}_{variant:02d}.jpg"
DEFAULT_OUTPUT = "config/pending/trainer_card_backgrounds.discovered.yaml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-location", type=int, default=1, help="First 1-based location id to probe.")
    parser.add_argument("--end-location", type=int, required=True, help="Last 1-based location id to probe.")
    parser.add_argument("--variant-start", type=int, default=0, help="First variant id to probe.")
    parser.add_argument(
        "--variant-end",
        type=int,
        default=99,
        help="Safety ceiling for variant probing; each location stops earlier on first missing variant.",
    )
    parser.add_argument(
        "--keep-going-after-variant-miss",
        action="store_true",
        help="Probe every variant up to --variant-end instead of moving to the next location on first miss.",
    )
    parser.add_argument(
        "--stop-location-on-first-miss",
        action="store_true",
        help="Stop the location loop when the first variant of a location is missing.",
    )
    parser.add_argument("--expect-found", type=int, help="Validate the discovered background count after probing.")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds to sleep between requests.")
    parser.add_argument("--timeout", type=float, default=10.0, help="Per-request timeout in seconds.")
    parser.add_argument("--pattern", default=DEFAULT_PATTERN, help="URL format pattern.")
    parser.add_argument("--output", type=Path, default=Path(DEFAULT_OUTPUT), help="Output text/YAML file.")
    parser.add_argument("--append", action="store_true", help="Append to the output file instead of overwriting it.")
    parser.add_argument(
        "--format",
        choices=("yaml", "urls"),
        default="yaml",
        help="Write curated YAML entries or plain URLs.",
    )
    return parser.parse_args()


def exists(url: str, timeout: float) -> bool:
    req = Request(url, method="HEAD", headers={"User-Agent": "HorseTrader/0.1 asset discovery"})
    try:
        with urlopen(req, timeout=timeout) as response:
            return 200 <= response.status < 400
    except HTTPError as exc:
        if exc.code == 404:
            return False
        print(f"warning: {url} returned HTTP {exc.code}", file=sys.stderr)
        return False
    except URLError as exc:
        print(f"warning: {url} failed: {exc.reason}", file=sys.stderr)
        return False


def yaml_entry(location: int, variant: int, url: str) -> str:
    key = f"trainer-card-bg-{location:04d}-{variant:02d}"
    return (
        f"{key}:\n"
        f"  name: Background {location:04d}-{variant:02d}\n"
        f"  source: {url}\n"
        f"  source_page: https://gametora.com/umamusume\n"
    )


def main() -> int:
    args = parse_args()
    if args.start_location > args.end_location:
        raise SystemExit("--start-location must be <= --end-location")
    if args.variant_start > args.variant_end:
        raise SystemExit("--variant-start must be <= --variant-end")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    found = 0
    mode = "a" if args.append else "w"
    with args.output.open(mode, encoding="utf-8") as out:
        if args.format == "yaml" and not args.append:
            out.write("# Discovered trainer-card backgrounds. Review labels before curating.\n")
        for location in range(args.start_location, args.end_location + 1):
            for variant in range(args.variant_start, args.variant_end + 1):
                url = args.pattern.format(location=location, variant=variant)
                print(f"checking {url}", file=sys.stderr)
                hit = exists(url, args.timeout)
                if hit:
                    found += 1
                    if args.format == "yaml":
                        out.write(yaml_entry(location, variant, url))
                    else:
                        out.write(f"{url}\n")
                    out.flush()
                    print(f"found {url}", file=sys.stderr)
                elif variant == args.variant_start:
                    if args.stop_location_on_first_miss:
                        print(
                            f"stopping at location {location:04d}: first variant is missing",
                            file=sys.stderr,
                        )
                        print(f"wrote {found} discovered background(s) to {args.output}", file=sys.stderr)
                        return 0
                    print(f"skipping location {location:04d}: first variant is missing", file=sys.stderr)
                    time.sleep(args.delay)
                    break
                elif not args.keep_going_after_variant_miss:
                    print(
                        f"moving to next location after missing {location:04d}_{variant:02d}",
                        file=sys.stderr,
                    )
                    time.sleep(args.delay)
                    break
                time.sleep(args.delay)
            out.flush()

    print(f"wrote {found} discovered background(s) to {args.output}", file=sys.stderr)
    if args.expect_found is not None and found != args.expect_found:
        print(
            f"expected {args.expect_found} discovered background(s), found {found}",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
