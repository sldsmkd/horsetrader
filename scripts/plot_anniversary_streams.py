#!/usr/bin/env python
"""Plot anniversary samples by isolated economy stream.

Input is the raw matrix CSV produced by:

    make report-anniversary-economy

The default output is a 2560x1440 PNG under reports/. The renderer uses pandas
for the data frame and Pillow for drawing, with optional Tk display via --show.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Iterable

import pandas as pd
from PIL import Image, ImageDraw, ImageFont, ImageTk


PALETTE = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
    "#003f5c",
    "#bc5090",
    "#ffa600",
]

GROUPS = [
    {
        "name": "off-axis-modifiers",
        "color": "#0ea5b7",
        "streams": [
            "subscription.daily-pack",
            "subscription.training-pass",
            "identity.club-rank",
        ],
    },
    {
        "name": "participate",
        "color": "#16a34a",
        "streams": [
            "event.trainee-debuts",
            "event.anniversary-missions",
            "event.holidays",
            "event.scenario-missions",
            "play.story",
            "play.dailies",
            "play.weekly-login",
            "play.shop-tickets",
            "play.team-trials",
        ],
    },
    {
        "name": "engage",
        "color": "#7c3aed",
        "streams": [
            "event.factor-studies",
            "event.racing-carnival",
            "event.showtime",
            "event.missions",
        ],
    },
    {
        "name": "compete",
        "color": "#dc2626",
        "streams": [
            "play.champions-meeting",
            "play.league-of-heroes",
            "play.strongest-team",
        ],
    },
    {
        "name": "challenge",
        "color": "#0891b2",
        # PvE modes where the economy outcome depends on clearing a real power
        # or strategy check, rather than merely showing up.
        "streams": [
            "event.legend-races",
            "event.skill-tests",
            "play.masters-challenge",
        ],
    },
]

STREAM_GROUP = {
    stream: {"order": order, "name": group["name"], "color": group["color"]}
    for order, group in enumerate(GROUPS)
    for stream in group["streams"]
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Plot one resource per stream from the anniversary matrix CSV.")
    parser.add_argument("--csv", default="reports/anniversary-raw-matrix.csv", help="Input raw matrix CSV")
    parser.add_argument("--out", default="reports/anniversary-streams-free-carats.png", help="Output PNG path")
    parser.add_argument("--resource", default="free_carats", help="Resource row to plot, e.g. free_carats or carat_equivalent")
    parser.add_argument("--show", action="store_true", help="Show an interactive Tk window after saving")
    parser.add_argument("--width", type=int, default=2560, help="Canvas width in pixels")
    parser.add_argument("--height", type=int, default=1440, help="Canvas height in pixels")
    parser.add_argument("--cols", type=int, default=5, help="Subplot columns")
    return parser.parse_args()


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=face)
    return box[2] - box[0], box[3] - box[1]


def draw_centered(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, face: ImageFont.ImageFont, fill: str) -> None:
    w, h = text_size(draw, text, face)
    draw.text((xy[0] - w / 2, xy[1] - h / 2), text, font=face, fill=fill)


def draw_rotated_text(image: Image.Image, xy: tuple[int, int], text: str, face: ImageFont.ImageFont, angle: int = 45) -> None:
    temp = Image.new("RGBA", (260, 56), (255, 255, 255, 0))
    temp_draw = ImageDraw.Draw(temp)
    temp_draw.text((0, 0), text, font=face, fill="#202124")
    rotated = temp.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    image.alpha_composite(rotated, (xy[0], xy[1]))


def compact_sample_label(name: str) -> str:
    if name == "Launch banners":
        return "Launch"
    return (
        name.replace("Half Anniversary", "0.5")
        .replace("st Anniversary", ".0")
        .replace("nd Anniversary", ".0")
        .replace("rd Anniversary", ".0")
        .replace("th Anniversary", "")
    )


def nice_ticks(max_value: float, count: int = 4) -> list[float]:
    if max_value <= 0:
        return [0]
    raw_step = max_value / count
    magnitude = 10 ** math.floor(math.log10(raw_step))
    residual = raw_step / magnitude
    if residual <= 1:
        step = magnitude
    elif residual <= 2:
        step = 2 * magnitude
    elif residual <= 5:
        step = 5 * magnitude
    else:
        step = 10 * magnitude
    top = math.ceil(max_value / step) * step
    return [i * step for i in range(int(top / step) + 1)]


def points_for(values: list[float], xs: list[float], top: float, bottom: float, max_y: float) -> list[tuple[float, float]]:
    if max_y <= 0:
        return [(x, bottom) for x in xs]
    return [(x, bottom - (value / max_y) * (bottom - top)) for x, value in zip(xs, values)]


def grouped_cases(df: pd.DataFrame, stream: str, resource: str) -> Iterable[tuple[str, pd.Series]]:
    stream_rows = df[df["stream"].eq(stream)]
    resource_rows = stream_rows[stream_rows["resource"].eq(resource)]
    seen = stream_rows[["parameter", "value"]].drop_duplicates()
    for parameter, value in seen.itertuples(index=False):
        case = resource_rows[resource_rows["parameter"].eq(parameter) & resource_rows["value"].eq(value)]
        yield str(value), case.groupby("index")["amount"].sum()


def ordered_streams(streams: Iterable[str]) -> list[str]:
    original_order = {stream: index for index, stream in enumerate(streams)}

    def key(stream: str) -> tuple[int, int, int]:
        group = STREAM_GROUP.get(stream)
        if group:
            return (0, int(group["order"]), original_order[stream])
        return (1, 0, original_order[stream])

    return sorted(original_order, key=key)


def plot_stream(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    df: pd.DataFrame,
    stream: str,
    sample_indexes: list[int],
    sample_labels: list[str],
    resource: str,
    box: tuple[int, int, int, int],
    faces: dict[str, ImageFont.ImageFont],
) -> None:
    x0, y0, x1, y1 = box
    group = STREAM_GROUP.get(stream)
    border = str(group["color"]) if group else "#444444"
    draw.rectangle(box, outline=border, width=4 if group else 2)

    if group:
        label = str(group["name"])
        label_w, label_h = text_size(draw, label, faces["tiny"])
        pill = (x0 + 8, y0 + 8, x0 + label_w + 22, y0 + label_h + 16)
        draw.rounded_rectangle(pill, radius=6, fill=border)
        draw.text((x0 + 15, y0 + 11), label, font=faces["tiny"], fill="#ffffff")

    draw_centered(draw, ((x0 + x1) / 2, y0 + 18), stream, faces["subtitle"], "#111111")

    plot_left = x0 + 72
    plot_top = y0 + 48
    plot_right = x1 - 18
    plot_bottom = y1 - 52
    draw.line((plot_left, plot_top, plot_left, plot_bottom, plot_right, plot_bottom), fill="#333333", width=1)

    cases = []
    max_y = 0.0
    for label, series in grouped_cases(df, stream, resource):
        values = series.reindex(sample_indexes, fill_value=0).astype(float).tolist()
        max_y = max(max_y, *values)
        cases.append((label, values))

    ticks = nice_ticks(max_y)
    axis_max = max(ticks) if ticks else 1
    for tick in ticks:
        y = plot_bottom if axis_max == 0 else plot_bottom - (tick / axis_max) * (plot_bottom - plot_top)
        draw.line((plot_left, y, plot_right, y), fill="#e0e0e0", width=1)
        label = f"{int(tick):,}"
        tw, th = text_size(draw, label, faces["small"])
        draw.text((plot_left - tw - 7, y - th / 2), label, font=faces["small"], fill="#333333")

    if len(sample_indexes) == 1:
        xs = [(plot_left + plot_right) / 2]
    else:
        xs = [
            plot_left + (plot_right - plot_left) * i / (len(sample_indexes) - 1)
            for i in range(len(sample_indexes))
        ]

    for x, label in zip(xs, sample_labels):
        draw.line((x, plot_bottom, x, plot_top), fill="#eeeeee", width=1)
        draw_centered(draw, (x, plot_bottom + 18), label, faces["tiny"], "#202124")

    for idx, (label, values) in enumerate(cases):
        color = PALETTE[idx % len(PALETTE)]
        pts = points_for(values, xs, plot_top, plot_bottom, axis_max)
        if len(pts) > 1:
            draw.line(pts, fill=color, width=3, joint="curve")
        for px, py in pts:
            draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=color)

    legend_x = plot_left + 8
    legend_y = plot_top + 8
    for idx, (label, _values) in enumerate(cases):
        color = PALETTE[idx % len(PALETTE)]
        row_y = legend_y + idx * 15
        if row_y > plot_bottom - 12:
            break
        draw.line((legend_x, row_y + 5, legend_x + 18, row_y + 5), fill=color, width=3)
        draw.text((legend_x + 24, row_y), label, font=faces["tiny"], fill="#202124")


def show_image(path: Path) -> None:
    import tkinter as tk

    root = tk.Tk()
    root.title(str(path))
    pil_image = Image.open(path)
    photo = ImageTk.PhotoImage(pil_image)
    label = tk.Label(root, image=photo)
    label.image = photo
    label.pack()
    root.mainloop()


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}. Run `make report-anniversary-economy` first.")

    df = pd.read_csv(csv_path)
    samples = df[["index", "name"]].drop_duplicates().sort_values("index")
    sample_indexes = [int(value) for value in samples["index"].tolist()]
    sample_labels = [compact_sample_label(str(value)) for value in samples["name"].tolist()]
    streams = ordered_streams(str(value) for value in df["stream"].drop_duplicates().tolist())

    width = max(900, args.width)
    height = max(700, args.height)
    cols = max(1, args.cols)
    rows = math.ceil(len(streams) / cols)

    image = Image.new("RGBA", (width, height), "#ffffff")
    draw = ImageDraw.Draw(image)
    faces = {
        "title": font(34, bold=True),
        "subtitle": font(22, bold=True),
        "small": font(12),
        "tiny": font(10),
    }

    draw_centered(
        draw,
        (width / 2, 36),
        f"{args.resource} By Economy Stream At Anniversary Sample Points",
        faces["title"],
        "#000000",
    )

    margin_x = 42
    top = 90
    bottom_margin = 28
    gap_x = 34
    gap_y = 44
    cell_w = int((width - 2 * margin_x - gap_x * (cols - 1)) / cols)
    cell_h = int((height - top - bottom_margin - gap_y * (rows - 1)) / rows)

    for idx, stream in enumerate(streams):
        row = idx // cols
        col = idx % cols
        x0 = margin_x + col * (cell_w + gap_x)
        y0 = top + row * (cell_h + gap_y)
        plot_stream(
            image,
            draw,
            df,
            stream,
            sample_indexes,
            sample_labels,
            args.resource,
            (x0, y0, x0 + cell_w, y0 + cell_h),
            faces,
        )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(out_path)
    print(f"Wrote {out_path}")

    if args.show:
        show_image(out_path)


if __name__ == "__main__":
    main()
