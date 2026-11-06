import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from assetlib.build import build
from assetlib.check import check
from assetlib.ops import crop_file
from assetlib.testutil import make_layout

REPO = Path(__file__).resolve().parents[2] / 'projects' / 'content'
CLI = Path(__file__).resolve().parent.parent / 'build-assets.py'


def marked_image(path: Path) -> Path:
    """10x10 white image with a red 4x5 square whose top-left corner is (2, 3)."""
    im = Image.new('RGB', (10, 10), (255, 255, 255))
    for x in range(2, 6):
        for y in range(3, 8):
            im.putpixel((x, y), (255, 0, 0))
    im.save(path, 'PNG')
    return path


class CropTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.src = marked_image(self.dir / 'card.png')

    def test_crop_cuts_the_box(self):
        dest = self.dir / 'out.jpg'
        crop_file(self.src, dest, [2, 3, 4, 5], 92)
        with Image.open(dest) as cut:
            self.assertEqual(cut.format, 'JPEG')
            self.assertEqual(cut.size, (4, 5))
            red, green, blue = cut.getpixel((2, 2))
            self.assertGreater(red, 200)
            self.assertLess(green, 80)

    def test_box_outside_the_image_fails_naming_the_card(self):
        with self.assertRaises(ValueError) as ctx:
            crop_file(self.src, self.dir / 'out.jpg', [8, 8, 5, 5], 92)
        self.assertIn('card.png', str(ctx.exception))

    def test_non_positive_size_fails_naming_the_card(self):
        for box in ([1, 1, 0, 3], [1, 1, 3, -2], [-1, 0, 3, 3]):
            with self.assertRaises(ValueError) as ctx:
                crop_file(self.src, self.dir / 'out.jpg', box, 92)
            self.assertIn('card.png', str(ctx.exception))

    def test_lower_quality_makes_a_smaller_file(self):
        noisy = self.dir / 'noisy.png'
        im = Image.new('RGB', (64, 64))
        im.putdata([((x * 37) % 256, (x * 91) % 256, (x * 13) % 256) for x in range(64 * 64)])
        im.save(noisy)
        crop_file(noisy, self.dir / 'hi.jpg', [0, 0, 64, 64], 95)
        crop_file(noisy, self.dir / 'lo.jpg', [0, 0, 64, 64], 40)
        self.assertLess((self.dir / 'lo.jpg').stat().st_size, (self.dir / 'hi.jpg').stat().st_size)


class CropsThroughTheBuild(unittest.TestCase):
    RECIPES = {
        'playing-cards/full': {'op': 'copy', 'ext': 'jpg'},
        'playing-cards/cropped': {'op': 'crop', 'from': 'playing-cards/full', 'ext': 'jpg', 'quality': 90},
    }

    def make(self):
        layout = make_layout({}, self.RECIPES, {'tool/duel': [2, 3, 4, 5]})
        full = layout.src / 'playing-cards/full/tool'
        full.mkdir(parents=True)
        marked_image(full / 'duel.png').rename(full / 'duel.jpg')  # a PNG body is fine: Pillow reads by content
        return layout

    def test_build_cuts_the_crop_and_check_passes(self):
        layout = self.make()
        build(layout)
        with Image.open(layout.out / 'playing-cards/cropped/tool/duel.jpg') as cut:
            self.assertEqual(cut.size, (4, 5))
        self.assertEqual(check(layout), [])
        self.assertEqual(build(layout).built, 0)

    def run_cli(self, layout):
        return subprocess.run(
            [sys.executable, str(CLI), '--content', str(layout.content), 'build'],
            cwd=tempfile.gettempdir(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True,
        )

    def test_a_box_that_does_not_fit_fails_cleanly_naming_the_card(self):
        layout = self.make()
        layout.crops_file.write_text(json.dumps({'tool/duel': [2, 3, 40, 5]}))
        result = self.run_cli(layout)
        self.assertEqual(result.returncode, 1)
        self.assertIn('playing-cards/cropped/tool/duel.jpg', result.stdout)
        self.assertNotIn('Traceback', result.stdout)

    def test_an_unreadable_full_card_fails_cleanly_naming_the_card(self):
        layout = self.make()
        (layout.src / 'playing-cards/full/tool/duel.jpg').write_bytes(b'not an image')
        result = self.run_cli(layout)
        self.assertEqual(result.returncode, 1)
        self.assertIn('playing-cards/cropped/tool/duel.jpg', result.stdout)
        self.assertNotIn('Traceback', result.stdout)

    def test_changing_the_box_rebuilds_only_the_crop(self):
        layout = self.make()
        build(layout)
        layout.crops_file.write_text(json.dumps({'tool/duel': [2, 3, 3, 3]}))
        self.assertEqual(check(layout)[0].startswith('stale: playing-cards/cropped/tool/duel.jpg'), True)
        report = build(layout)
        self.assertEqual((report.built, report.skipped), (1, 1))

    def test_changing_the_quality_rebuilds_the_crop(self):
        layout = self.make()
        build(layout)
        layout.recipes_file.write_text(json.dumps({**self.RECIPES, 'playing-cards/cropped': {**self.RECIPES['playing-cards/cropped'], 'quality': 50}}))
        self.assertEqual(build(layout).built, 1)


class RepoCropData(unittest.TestCase):
    def test_crop_data_covers_every_full_card(self):
        full = REPO / 'assets-src/playing-cards/full'
        if not full.is_dir():
            self.skipTest('masters are not in assets-src yet')
        boxes = json.loads((REPO / 'asset-crops.json').read_text())
        cards = {p.relative_to(full).with_suffix('').as_posix(): p for p in full.rglob('*.jpg')}
        self.assertEqual(sorted(boxes), sorted(cards))
        self.assertEqual(len(boxes), 49)
        for card, (x, y, w, h) in boxes.items():
            with Image.open(cards[card]) as image:
                width, height = image.size
            self.assertTrue(w > 0 and h > 0 and x >= 0 and y >= 0 and x + w <= width and y + h <= height, card)


if __name__ == '__main__':
    unittest.main()
