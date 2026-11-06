import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from assetlib.build import build
from assetlib.check import check
from assetlib.ops import BuildError, image_file
from assetlib.testutil import make_layout


def rgba_png(path: Path, size=(8, 8)) -> Path:
    """Transparent everywhere except an opaque red centre block and one half-transparent pixel."""
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    for x in range(2, 6):
        for y in range(2, 6):
            im.putpixel((x, y), (255, 0, 0, 255))
    im.putpixel((0, 0), (0, 255, 0, 128))
    im.save(path, 'PNG')
    return path


class ImageFileTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def test_converts_png_to_webp_keeping_size_and_transparency(self):
        src = rgba_png(self.dir / 'skin.png')
        dest = self.dir / 'skin.webp'
        image_file(src, dest, 'webp', 85, 100)
        with Image.open(dest) as out:
            self.assertEqual(out.format, 'WEBP')
            self.assertEqual(out.size, (8, 8))
            rgba = out.convert('RGBA')
            self.assertEqual(rgba.getpixel((7, 7))[3], 0)  # still transparent
            red, green, blue, alpha = rgba.getpixel((3, 3))
            self.assertEqual(alpha, 255)
            self.assertGreater(red, 200)
            self.assertLess(green, 60)
            self.assertAlmostEqual(rgba.getpixel((0, 0))[3], 128, delta=8)  # soft edge kept

    def test_reads_a_jpeg_master_too(self):
        src = self.dir / 'card.jpg'
        Image.new('RGB', (16, 16), (10, 120, 200)).save(src, 'JPEG')
        image_file(src, self.dir / 'card.webp', 'webp', 85, 100)
        with Image.open(self.dir / 'card.webp') as out:
            self.assertEqual((out.format, out.size), ('WEBP', (16, 16)))

    def test_lower_quality_makes_a_smaller_file(self):
        src = self.dir / 'noisy.png'
        im = Image.new('RGB', (64, 64))
        im.putdata([((x * 37) % 256, (x * 91) % 256, (x * 13) % 256) for x in range(64 * 64)])
        im.save(src)
        image_file(src, self.dir / 'hi.webp', 'webp', 95, 100)
        image_file(src, self.dir / 'lo.webp', 'webp', 40, 100)
        self.assertLess((self.dir / 'lo.webp').stat().st_size, (self.dir / 'hi.webp').stat().st_size)

    def test_creates_the_folder_of_the_output(self):
        image_file(rgba_png(self.dir / 'a.png'), self.dir / 'deep/er/a.webp', 'webp', 85, 100)
        self.assertTrue((self.dir / 'deep/er/a.webp').is_file())


class ImageThroughTheBuild(unittest.TestCase):
    COPY = {'generals/skins': {'op': 'copy', 'ext': 'png'}}
    IMAGE = {'generals/skins': {'op': 'image', 'ext': 'webp', 'quality': 85}}

    def make(self, recipes):
        layout = make_layout({}, recipes)
        skin = layout.src / 'generals/skins/wei'
        skin.mkdir(parents=True)
        rgba_png(skin / 'a.png')
        return layout

    def test_build_writes_webp_and_check_passes(self):
        layout = self.make(self.IMAGE)
        self.assertEqual(build(layout).built, 1)
        with Image.open(layout.out / 'generals/skins/wei/a.webp') as out:
            self.assertEqual(out.format, 'WEBP')
        self.assertFalse((layout.out / 'generals/skins/wei/a.png').exists())
        self.assertEqual(check(layout), [])
        self.assertEqual(build(layout).built, 0)

    def test_switching_from_copy_to_image_replaces_the_old_file(self):
        layout = self.make(self.COPY)
        build(layout)
        self.assertTrue((layout.out / 'generals/skins/wei/a.png').exists())
        layout.recipes_file.write_text(json.dumps(self.IMAGE))
        self.assertTrue(check(layout))  # stale until rebuilt
        report = build(layout)
        self.assertEqual((report.built, report.removed), (1, 1))
        self.assertFalse((layout.out / 'generals/skins/wei/a.png').exists())
        self.assertTrue((layout.out / 'generals/skins/wei/a.webp').exists())
        self.assertEqual(check(layout), [])

    def test_changing_the_quality_rebuilds(self):
        layout = self.make(self.IMAGE)
        build(layout)
        layout.recipes_file.write_text(json.dumps({'generals/skins': {'op': 'image', 'ext': 'webp', 'quality': 70}}))
        self.assertEqual(build(layout).built, 1)

    def test_an_unreadable_master_fails_cleanly_naming_the_output(self):
        layout = self.make(self.IMAGE)
        (layout.src / 'generals/skins/wei/a.png').write_bytes(b'not an image')
        with self.assertRaises(BuildError) as ctx:
            build(layout)
        self.assertIn('generals/skins/wei/a.webp', str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
