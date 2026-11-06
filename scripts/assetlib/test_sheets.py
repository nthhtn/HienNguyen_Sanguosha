import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from assetlib import sheets
from assetlib.build import build
from assetlib.check import check
from assetlib.testutil import make_layout

REPO = Path(__file__).resolve().parents[2] / 'projects' / 'content'
# The effect id to frames folder map of the sheets recipe (asset-recipes.json, "effects/sheets").
REAL_MAP = {
    'slash': 'slash-red', 'slash-fire': 'fire-slash', 'slash-lightning': 'thunder-slash',
    'damage': 'damage', 'fire': 'fire', 'lightning': 'lightning', 'chain': 'chain',
}


def write_frames(areas):
    """One 4x4 RGBA frame per entry; `area` opaque pixels on the first row, so the opaque box grows with it."""
    folder = Path(tempfile.mkdtemp())
    for i, area in enumerate(areas):
        frame = Image.new('RGBA', (4, 4), (0, 0, 0, 0))
        for x in range(area):
            frame.putpixel((x % 4, x // 4), (255, 0, 0, 255))
        frame.save(folder / '{}.png'.format(i))
    return folder


def pixels(path: Path):
    """Size and decoded pixels of an image: what a sheet shows, whatever PNG encoder and zlib wrote it."""
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        return rgba.size, rgba.tobytes()


class PixelComparisonTests(unittest.TestCase):
    def test_pixels_ignore_how_the_png_was_encoded_but_not_what_it_shows(self):
        folder = write_frames([4, 8, 12])
        original = folder / 'sheet.png'
        sheets.build_sheet(folder, original)
        with Image.open(original) as image:
            image.save(folder / 'reencoded.png', compress_level=1, optimize=False)
            changed = image.convert('RGBA')
            changed.putpixel((0, 0), (1, 2, 3, 255))
            changed.save(folder / 'changed.png')
        self.assertNotEqual(original.read_bytes(), (folder / 'reencoded.png').read_bytes())
        self.assertEqual(pixels(original), pixels(folder / 'reencoded.png'))
        self.assertNotEqual(pixels(original), pixels(folder / 'changed.png'))


class SheetTests(unittest.TestCase):
    def test_sheet_grid_holds_every_frame(self):
        folder = write_frames([4] * 7)
        out = folder / 'sheet.png'
        meta = sheets.build_sheet(folder, out)
        self.assertEqual((meta['frames'], meta['cols'], meta['rows']), (7, 6, 2))
        self.assertEqual((meta['width'], meta['height']), (4, 4))
        with Image.open(out) as built:
            self.assertEqual(built.size, (24, 8))

    def test_pop_detected_when_a_small_first_frame_grows(self):
        meta = sheets.sheet_meta(write_frames([1, 1, 16, 16, 16]))
        self.assertTrue(meta['pop'])
        self.assertEqual(meta['lead'], 2)

    def test_no_pop_when_every_frame_is_about_as_large(self):
        meta = sheets.sheet_meta(write_frames([8, 8, 8, 8]))
        self.assertFalse(meta['pop'])
        self.assertEqual(meta['lead'], 1)

    def test_mismatched_frame_sizes_fail_naming_the_folder(self):
        folder = write_frames([4, 4])
        Image.new('RGBA', (5, 4)).save(folder / '1.png')
        with self.assertRaises(ValueError) as ctx:
            sheets.sheet_meta(folder)
        self.assertIn(folder.name, str(ctx.exception))

    def test_sheets_json_is_two_space_indented_with_a_trailing_newline(self):
        text = sheets.sheets_json({'slash': {'frames': 1}})
        self.assertEqual(text, json.dumps({'slash': {'frames': 1}}, indent=2) + '\n')

    def test_repo_sheets_match_committed_files(self):
        frames_root = next((p for p in (REPO / 'assets-src/effects/frames', REPO / 'assets/effects/frames') if p.is_dir()), None)
        if frames_root is None:
            self.skipTest('no sprite frames in the repo')
        committed = REPO / 'assets/effects/sheets'
        manifest = {}
        for effect, folder in REAL_MAP.items():
            out = Path(tempfile.mkdtemp()) / '{}.png'.format(effect)
            manifest[effect] = sheets.build_sheet(frames_root / folder, out)
            self.assertEqual(pixels(out), pixels(committed / '{}.png'.format(effect)), effect)
        self.assertEqual(sheets.sheets_json(manifest), (committed / 'sheets.json').read_text())


class SheetsThroughTheBuild(unittest.TestCase):
    def test_build_makes_each_sheet_and_the_json_and_check_passes(self):
        recipes = {
            'effects/frames': {'op': 'master-only'},
            'effects/sheets': {'op': 'sheets', 'from': 'effects/frames', 'map': {'slash': 'slash-red', 'chain': 'chain'}},
        }
        layout = make_layout({}, recipes)
        for folder in ('slash-red', 'chain'):
            frames = layout.src / 'effects/frames' / folder
            frames.mkdir(parents=True)
            for i in range(3):
                Image.new('RGBA', (4, 4), (255, 0, 0, 255)).save(frames / '{}.png'.format(i))
        report = build(layout)
        self.assertEqual(report.built, 3)
        manifest = json.loads((layout.out / 'effects/sheets/sheets.json').read_text())
        self.assertEqual(list(manifest), ['slash', 'chain'])
        self.assertEqual(manifest['slash']['frames'], 3)
        self.assertTrue((layout.out / 'effects/sheets/slash.png').is_file())
        self.assertEqual(check(layout), [])
        self.assertEqual(build(layout).built, 0)

    def test_removing_a_frame_makes_check_stale_and_build_rebuilds(self):
        recipes = {
            'effects/frames': {'op': 'master-only'},
            'effects/sheets': {'op': 'sheets', 'from': 'effects/frames', 'map': {'chain': 'chain'}},
        }
        layout = make_layout({}, recipes)
        frames = layout.src / 'effects/frames/chain'
        frames.mkdir(parents=True)
        for i in range(3):
            Image.new('RGBA', (4, 4), (255, 0, 0, 255)).save(frames / '{}.png'.format(i))
        build(layout)
        (frames / '2.png').unlink()
        problems = check(layout)
        self.assertTrue(problems)
        self.assertTrue(all('stale' in p for p in problems))
        self.assertTrue(any('effects/frames/chain/2.png' in p for p in problems))
        self.assertEqual(build(layout).built, 2)
        self.assertEqual(check(layout), [])


if __name__ == '__main__':
    unittest.main()
