import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from assetlib.build import build
from assetlib.check import check
from assetlib.testutil import make_layout

CLI = Path(__file__).resolve().parent.parent / 'build-assets.py'
RECIPES = {'ui': {'op': 'copy'}}


def two_files():
    return make_layout({'ui/a.png': b'a', 'ui/b.png': b'b'}, RECIPES)


class BuildTests(unittest.TestCase):
    def test_build_copies_bytes_and_writes_a_lock_that_passes_check(self):
        layout = two_files()
        report = build(layout)
        self.assertEqual((report.built, report.skipped, report.removed), (2, 0, 0))
        self.assertEqual((layout.out / 'ui/a.png').read_bytes(), b'a')
        self.assertEqual(check(layout), [])

    def test_second_build_changes_nothing(self):
        layout = two_files()
        build(layout)
        lock_before = layout.lock_file.read_bytes()
        for name in ('a', 'b'):  # age the outputs so a rewrite would show in the mtime
            os.utime(layout.out / 'ui/{}.png'.format(name), (1_000_000_000, 1_000_000_000))
        report = build(layout)
        self.assertEqual((report.built, report.skipped), (0, 2))
        self.assertEqual(layout.lock_file.read_bytes(), lock_before)
        for name in ('a', 'b'):
            self.assertEqual(int((layout.out / 'ui/{}.png'.format(name)).stat().st_mtime), 1_000_000_000)

    def test_build_rewrites_only_what_changed(self):
        layout = two_files()
        build(layout)
        (layout.src / 'ui/a.png').write_bytes(b'changed')
        report = build(layout)
        self.assertEqual((report.built, report.skipped), (1, 1))
        self.assertEqual((layout.out / 'ui/a.png').read_bytes(), b'changed')

    def test_build_removes_stray_outputs_and_ignores_junk(self):
        layout = make_layout({'ui/a.png': b'a', 'ui/.DS_Store': b'junk'}, RECIPES)
        build(layout)
        (layout.out / 'old').mkdir()
        (layout.out / 'old/gone.png').write_bytes(b'x')
        (layout.out / 'ui/.DS_Store').write_bytes(b'junk')
        report = build(layout)
        self.assertEqual(report.removed, 1)
        self.assertFalse((layout.out / 'old').exists())
        self.assertTrue((layout.out / 'ui/.DS_Store').exists())
        self.assertEqual(sorted(p.name for p in (layout.out / 'ui').iterdir() if p.name != '.DS_Store'), ['a.png'])
        self.assertEqual(check(layout), [])

    def test_hand_edited_output_is_restored_on_build(self):
        layout = two_files()
        build(layout)
        (layout.out / 'ui/a.png').write_bytes(b'hand edit')
        report = build(layout)
        self.assertEqual(report.built, 1)
        self.assertEqual((layout.out / 'ui/a.png').read_bytes(), b'a')

    def test_lock_is_deterministic(self):
        layout = two_files()
        build(layout)
        text = layout.lock_file.read_text()
        self.assertTrue(text.endswith('\n'))
        self.assertNotIn('\\', text)
        self.assertNotIn('\r', text)
        self.assertEqual(text, json.dumps(json.loads(text), indent=2, sort_keys=True) + '\n')
        layout.lock_file.unlink()
        build(layout)
        self.assertEqual(layout.lock_file.read_text(), text)


class CliTests(unittest.TestCase):
    def run_cli(self, layout, command):
        return subprocess.run(
            [sys.executable, str(CLI), '--content', str(layout.content), command],
            cwd=tempfile.gettempdir(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True,
        )

    def test_cli_runs_from_another_directory(self):
        layout = two_files()
        self.assertEqual(self.run_cli(layout, 'build').returncode, 0)
        self.assertEqual(self.run_cli(layout, 'check').returncode, 0)
        (layout.src / 'ui/a.png').write_bytes(b'changed')
        result = self.run_cli(layout, 'check')
        self.assertEqual(result.returncode, 1)
        self.assertIn('ui/a.png', result.stdout)
        self.assertIn('npm run assets:build', result.stdout)

    def test_cli_reports_a_master_with_no_recipe(self):
        layout = make_layout({'lost/x.png': b'x'}, RECIPES)
        result = self.run_cli(layout, 'build')
        self.assertEqual(result.returncode, 1)
        self.assertIn('lost/x.png', result.stdout)


if __name__ == '__main__':
    unittest.main()
