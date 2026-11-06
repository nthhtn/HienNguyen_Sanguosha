#!/usr/bin/env python3
"""Packs the frame folders in projects/content/assets/effects/frames into the sheets the seat effects play.

Run from the repo root after changing a folder: python3 scripts/build-sprite-sheets.py
Writes projects/content/assets/effects/sheets/<id>.png and sheets.json (see
docs/superpowers/specs/2026-11-03-sprite-animations-design.md).
"""
import json
import math
import os

from PIL import Image

ASSETS = 'projects/content/assets'
SPRITES = f'{ASSETS}/effects/frames'
OUT = f'{ASSETS}/effects/sheets'
MAX_COLS = 6

# Effect id -> the folder of numbered frames (0.png, 1.png, ...).
SHEETS = {
    'slash': 'slash-red',
    'slash-fire': 'fire-slash',
    'slash-lightning': 'thunder-slash',
    'damage': 'damage',
    'fire': 'fire',
    'lightning': 'lightning',
    'chain': 'chain',
}


def opaque_area(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return 0 if not box else (box[2] - box[0]) * (box[3] - box[1])


def build(folder):
    count = len([f for f in os.listdir(f'{SPRITES}/{folder}') if f.endswith('.png')])
    frames = [Image.open(f'{SPRITES}/{folder}/{i}.png').convert('RGBA') for i in range(count)]
    width, height = frames[0].size
    assert all(f.size == (width, height) for f in frames), f'{folder}: frames differ in size'
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


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for effect, folder in SHEETS.items():
        sheet, meta = build(folder)
        sheet.save(f'{OUT}/{effect}.png', optimize=True)
        manifest[effect] = meta
        print(f'{effect}: {folder}, {meta}')
    with open(f'{OUT}/sheets.json', 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
