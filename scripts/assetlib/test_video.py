import json
import os
import shutil
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from assetlib.build import build
from assetlib.check import check
from assetlib.ops import BuildError, video_file
from assetlib.testutil import make_layout

HAS_FFMPEG = shutil.which('ffmpeg') is not None and shutil.which('ffprobe') is not None


def make_video(path: Path, size='1920x1080', rate=60, seconds=1, audio=False) -> Path:
    """A small H.264 test video made with ffmpeg itself."""
    command = ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size={}:rate={}'.format(size, rate)]
    if audio:
        command += ['-f', 'lavfi', '-i', 'sine=frequency=440']
    command += ['-t', str(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p']
    if audio:
        command += ['-c:a', 'aac', '-shortest']
    subprocess.check_call(command + [str(path)])
    return path


def probe(path: Path) -> dict:
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', str(path)], universal_newlines=True)
    streams = json.loads(out)['streams']
    video = next(s for s in streams if s['codec_type'] == 'video')
    num, den = video['avg_frame_rate'].split('/')
    return {
        'codec': video['codec_name'], 'pix_fmt': video['pix_fmt'], 'width': video['width'], 'height': video['height'],
        'fps': round(int(num) / int(den)), 'audio': sum(1 for s in streams if s['codec_type'] == 'audio'),
    }


def box_order(path: Path):
    """The top-level boxes of an MP4, in file order."""
    order = []
    with open(path, 'rb') as handle:
        while True:
            head = handle.read(8)
            if len(head) < 8:
                break
            size, kind = struct.unpack('>I4s', head)
            order.append(kind.decode())
            if size == 1:
                size = struct.unpack('>Q', handle.read(8))[0]
                handle.seek(size - 16, 1)
            elif size == 0:
                break
            else:
                handle.seek(size - 8, 1)
    return order


@unittest.skipUnless(HAS_FFMPEG, 'ffmpeg and ffprobe are needed')
class VideoFileTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def convert(self, src, **kwargs):
        dest = self.dir / 'out.mp4'
        settings = dict(max_width=960, fps=60, crf=24, preset='veryfast')
        settings.update(kwargs)
        video_file(src, dest, **settings)
        return dest

    def test_scales_down_keeping_the_aspect_ratio_and_stays_h264_yuv420p(self):
        out = probe(self.convert(make_video(self.dir / 'src.mp4')))
        self.assertEqual((out['width'], out['height']), (960, 540))
        self.assertEqual((out['codec'], out['pix_fmt']), ('h264', 'yuv420p'))

    def test_never_scales_up(self):
        out = probe(self.convert(make_video(self.dir / 'small.mp4', size='640x360')))
        self.assertEqual((out['width'], out['height']), (640, 360))

    def test_keeps_the_height_even_for_an_odd_aspect_ratio(self):
        out = probe(self.convert(make_video(self.dir / 'odd.mp4', size='1600x900'), max_width=800))
        self.assertEqual(out['width'], 800)
        self.assertEqual(out['height'] % 2, 0)

    def test_caps_the_frame_rate_but_never_raises_it(self):
        self.assertEqual(probe(self.convert(make_video(self.dir / 'fast.mp4', size='640x360', rate=120), fps=60))['fps'], 60)
        self.assertEqual(probe(self.convert(make_video(self.dir / 'slow.mp4', size='640x360', rate=30), fps=60))['fps'], 30)
        self.assertEqual(probe(self.convert(make_video(self.dir / 'same.mp4', size='640x360', rate=60), fps=60))['fps'], 60)

    def test_drops_the_audio_track(self):
        self.assertEqual(probe(self.convert(make_video(self.dir / 'sound.mp4', audio=True)))['audio'], 0)

    def test_puts_the_index_first_so_playback_starts_at_once(self):
        order = box_order(self.convert(make_video(self.dir / 'src.mp4')))
        self.assertLess(order.index('moov'), order.index('mdat'))

    def test_is_smaller_than_the_master(self):
        src = make_video(self.dir / 'src.mp4', seconds=2)
        self.assertLess(self.convert(src).stat().st_size, src.stat().st_size)

    def test_a_higher_crf_makes_a_smaller_file(self):
        src = make_video(self.dir / 'src.mp4', seconds=2)
        sharp = self.convert(src, crf=18).stat().st_size
        soft = self.convert(src, crf=34).stat().st_size
        self.assertLess(soft, sharp)

    def test_an_unreadable_source_fails_with_a_message(self):
        bad = self.dir / 'bad.mp4'
        bad.write_bytes(b'not a video')
        with self.assertRaises(ValueError):
            self.convert(bad)


class VideoErrorTests(unittest.TestCase):
    RECIPES = {'preview': {'op': 'video', 'ext': 'mp4', 'maxWidth': 960, 'fps': 60, 'crf': 24, 'preset': 'veryfast'}}

    def test_a_missing_ffmpeg_gives_one_clear_message_naming_the_output(self):
        layout = make_layout({'preview/wu/a.mp4': b'not a video'}, self.RECIPES)
        empty = tempfile.mkdtemp()
        with mock.patch.dict(os.environ, {'PATH': empty}):
            with self.assertRaises(BuildError) as ctx:
                build(layout)
        message = str(ctx.exception)
        self.assertIn('preview/wu/a.mp4', message)
        self.assertIn('ffmpeg', message)


@unittest.skipUnless(HAS_FFMPEG, 'ffmpeg and ffprobe are needed')
class VideoThroughTheBuild(unittest.TestCase):
    RECIPES = {
        'preview': {'op': 'video', 'ext': 'mp4', 'maxWidth': 320, 'fps': 30, 'crf': 28, 'preset': 'veryfast'},
        'preview/index.json': {'op': 'copy'},
    }

    def make(self):
        layout = make_layout({'preview/index.json': b'{"a_b": ["en"]}'}, self.RECIPES)
        folder = layout.src / 'preview/wu'
        folder.mkdir(parents=True)
        make_video(folder / 'a_b_en.mp4', size='640x360', rate=60)
        return layout

    def test_build_ships_a_right_sized_copy_and_check_passes(self):
        layout = self.make()
        self.assertEqual(build(layout).built, 2)
        out = probe(layout.out / 'preview/wu/a_b_en.mp4')
        self.assertEqual((out['width'], out['height'], out['fps']), (320, 180, 30))
        self.assertEqual((layout.out / 'preview/index.json').read_bytes(), b'{"a_b": ["en"]}')
        self.assertEqual(check(layout), [])
        self.assertEqual(build(layout).built, 0)

    def test_changing_the_crf_rebuilds_the_video_only(self):
        layout = self.make()
        build(layout)
        layout.recipes_file.write_text(json.dumps({**self.RECIPES, 'preview': {**self.RECIPES['preview'], 'crf': 32}}))
        self.assertEqual(build(layout).built, 1)

    def test_an_unreadable_master_fails_cleanly_naming_the_output(self):
        layout = self.make()
        (layout.src / 'preview/wu/a_b_en.mp4').write_bytes(b'not a video')
        with self.assertRaises(BuildError) as ctx:
            build(layout)
        self.assertIn('preview/wu/a_b_en.mp4', str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
