"""Packs a folder of numbered frames (0.png, 1.png, ...) into the sprite sheet a seat effect plays.

Moved from scripts/build-sprite-sheets.py with the same output, byte for byte.
Design of the sheets: docs/superpowers/specs/2026-11-03-sprite-animations-design.md
"""
import json
import math
import os
from pathlib import Path
from typing import Dict, Tuple

from PIL import Image

MAX_COLS = 6


def opaque_area(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return 0 if not box else (box[2] - box[0]) * (box[3] - box[1])


def _pack(frames_dir: Path) -> Tuple[Image.Image, dict]:
    frames_dir = Path(frames_dir)
    folder = frames_dir.name
    count = len([f for f in os.listdir(frames_dir) if f.endswith('.png')])
    frames = []
    for i in range(count):
        with Image.open(frames_dir / '{}.png'.format(i)) as opened:
            frames.append(opened.convert('RGBA'))
    width, height = frames[0].size
    if not all(f.size == (width, height) for f in frames):
        raise ValueError('{}: frames differ in size'.format(folder))
    cols = min(count, MAX_COLS)
    rows = math.ceil(count / cols)
    sheet = Image.new('RGBA', (width * cols, height * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % cols) * width, (i // cols) * height))
    # The first large frame among the first few, when the sprite starts as a small speck: it pops in.
    first = opaque_area(frames[0])
    pop_at = next((i for i in range(1, min(4, count)) if opaque_area(frames[i]) > 2.5 * first), None)
    peak = max(range(count), key=lambda i: sum(frames[i].getchannel('A').getdata()))
    meta = {
        'frames': count,
        'cols': cols,
        'rows': rows,
        'width': width,
        'height': height,
        'lead': pop_at if pop_at is not None else 1,
        'burstEnd': round(count * 13 / 24),
        'pop': pop_at is not None,
        'peak': peak,
    }
    return sheet, meta


def sheet_meta(frames_dir: Path) -> dict:
    return _pack(frames_dir)[1]


def build_sheet(frames_dir: Path, out_png: Path) -> dict:
    sheet, meta = _pack(frames_dir)
    sheet.save(out_png, optimize=True)
    return meta


def sheets_json(manifest: Dict[str, dict]) -> str:
    return json.dumps(manifest, indent=2) + '\n'
