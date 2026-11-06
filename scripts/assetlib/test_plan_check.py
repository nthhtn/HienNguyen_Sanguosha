import json
import subprocess
import sys
import unittest
from pathlib import Path

from assetlib.check import check
from assetlib.layout import Layout
from assetlib.lockfile import read_lock, write_lock
from assetlib.plan import PlanError, plan_outputs
from assetlib.recipes import canonical_hash, load_recipes, recipe_for
from assetlib.testutil import build_by_hand, make_layout

SCRIPTS = Path(__file__).resolve().parent.parent


class PlanTests(unittest.TestCase):
    def test_copy_recipe_plans_one_output_per_master(self):
        layout = make_layout({'ui/a.png': b'a', 'ui/b.png': b'b'}, {'ui': {'op': 'copy'}})
        outputs = plan_outputs(layout)
        self.assertEqual(sorted(o.path for o in outputs), ['ui/a.png', 'ui/b.png'])
        a = next(o for o in outputs if o.path == 'ui/a.png')
        self.assertEqual((a.op, a.sources), ('copy', ('ui/a.png',)))

    def test_longest_key_wins(self):
        recipes = {'generals/skins': {'op': 'copy', 'ext': 'png'}, 'generals/skins/skins.json': {'op': 'copy'}}
        layout = make_layout({'generals/skins/skins.json': b'{}', 'generals/skins/wei/a.png': b'a'}, recipes)
        by_path = {o.path: o for o in plan_outputs(layout)}
        self.assertEqual(by_path['generals/skins/skins.json'].recipe_key, 'generals/skins/skins.json')
        self.assertEqual(by_path['generals/skins/wei/a.png'].recipe_key, 'generals/skins')

    def test_recipe_key_matches_whole_folder_names_only(self):
        recipes = {'ui': {'op': 'copy'}}
        self.assertEqual(recipe_for(recipes, 'ui/a.png')[0], 'ui')
        with self.assertRaises(Exception):
            recipe_for(recipes, 'uix/a.png')

    def test_junk_files_are_ignored(self):
        layout = make_layout({'ui/a.png': b'a', 'ui/.DS_Store': b'junk'}, {'ui': {'op': 'copy'}})
        self.assertEqual([o.path for o in plan_outputs(layout)], ['ui/a.png'])

    def test_master_without_recipe_fails(self):
        layout = make_layout({'ui/a.png': b'a', 'misc/lost.png': b'x'}, {'ui': {'op': 'copy'}})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('misc/lost.png', str(ctx.exception))

    def test_master_only_recipe_ships_nothing(self):
        layout = make_layout({'effects/frames/x/0.png': b'f'}, {'effects/frames': {'op': 'master-only'}})
        self.assertEqual(plan_outputs(layout), [])

    def test_ambiguous_stem_fails(self):
        recipes = {'generals/skins': {'op': 'copy'}}
        layout = make_layout({'generals/skins/wei/x.png': b'a', 'generals/skins/wei/x.jpg': b'b'}, recipes)
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('x.png', str(ctx.exception))
        self.assertIn('x.jpg', str(ctx.exception))

    def test_copy_ext_must_match_master(self):
        layout = make_layout({'generals/skins/a.png': b'a'}, {'generals/skins': {'op': 'copy', 'ext': 'webp'}})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('generals/skins/a.png', str(ctx.exception))

    def test_two_recipes_cannot_claim_one_output(self):
        recipes = {
            'playing-cards': {'op': 'copy'},
            'playing-cards/cropped': {'op': 'crop', 'from': 'playing-cards/full', 'ext': 'jpg'},
        }
        files = {'playing-cards/full/tool/duel.jpg': b'f', 'playing-cards/cropped/tool/duel.jpg': b'm'}
        with self.assertRaises(PlanError):
            plan_outputs(make_layout(files, recipes, {'tool/duel': [1, 2, 3, 4]}))

    CROP_RECIPES = {
        'playing-cards/full': {'op': 'copy', 'ext': 'jpg'},
        'playing-cards/cropped': {'op': 'crop', 'from': 'playing-cards/full', 'ext': 'jpg'},
    }

    def test_crop_outputs_follow_the_box_file(self):
        layout = make_layout({'playing-cards/full/tool/duel.jpg': b'f'}, self.CROP_RECIPES, {'tool/duel': [1, 2, 3, 4]})
        crop = next(o for o in plan_outputs(layout) if o.op == 'crop')
        self.assertEqual(crop.path, 'playing-cards/cropped/tool/duel.jpg')
        self.assertEqual(crop.sources, ('playing-cards/full/tool/duel.jpg',))
        self.assertEqual(crop.settings['box'], [1, 2, 3, 4])

    def test_crop_box_without_full_art_fails(self):
        layout = make_layout({}, self.CROP_RECIPES, {'tool/ghost': [1, 2, 3, 4]})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('tool/ghost', str(ctx.exception))

    def test_full_art_without_box_fails(self):
        layout = make_layout({'playing-cards/full/tool/duel.jpg': b'f'}, self.CROP_RECIPES, {})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('tool/duel', str(ctx.exception))

    def test_sheets_plan_one_sheet_per_effect_and_one_meta_file(self):
        recipes = {
            'effects/frames': {'op': 'master-only'},
            'effects/sheets': {'op': 'sheets', 'from': 'effects/frames', 'map': {'slash': 'slash-red', 'chain': 'chain'}},
        }
        files = {'effects/frames/slash-red/0.png': b'0', 'effects/frames/slash-red/1.png': b'1', 'effects/frames/chain/0.png': b'c'}
        outputs = {o.path: o for o in plan_outputs(make_layout(files, recipes))}
        self.assertEqual(sorted(outputs), ['effects/sheets/chain.png', 'effects/sheets/sheets.json', 'effects/sheets/slash.png'])
        self.assertEqual(outputs['effects/sheets/slash.png'].op, 'sheet')
        self.assertEqual(outputs['effects/sheets/slash.png'].settings, {'id': 'slash', 'folder': 'slash-red'})
        self.assertEqual(outputs['effects/sheets/slash.png'].sources, ('effects/frames/slash-red/0.png', 'effects/frames/slash-red/1.png'))
        self.assertEqual(outputs['effects/sheets/sheets.json'].op, 'sheets-meta')
        self.assertEqual(len(outputs['effects/sheets/sheets.json'].sources), 3)


class CheckTests(unittest.TestCase):
    def consistent(self) -> Layout:
        layout = make_layout({'ui/a.png': b'a', 'ui/b.png': b'b'}, {'ui': {'op': 'copy'}})
        build_by_hand(layout)
        return layout

    def test_clean_tree_passes(self):
        self.assertEqual(check(self.consistent()), [])

    def test_edited_master_is_stale(self):
        layout = self.consistent()
        (layout.src / 'ui/a.png').write_bytes(b'changed')
        problems = check(layout)
        self.assertEqual(len(problems), 1)
        self.assertIn('stale', problems[0])
        self.assertIn('ui/a.png', problems[0])

    def test_changed_recipe_is_stale(self):
        layout = self.consistent()
        layout.recipes_file.write_text(json.dumps({'ui': {'op': 'copy', 'ext': 'png'}}))
        problems = check(layout)
        self.assertTrue(problems)
        self.assertTrue(all('stale' in p and 'ui' in p for p in problems))

    def test_hand_edited_output_is_reported(self):
        layout = self.consistent()
        (layout.out / 'ui/a.png').write_bytes(b'hand edit')
        problems = check(layout)
        self.assertEqual(len(problems), 1)
        self.assertIn('edited', problems[0])
        self.assertIn('ui/a.png', problems[0])

    def test_missing_output_is_reported(self):
        layout = self.consistent()
        (layout.out / 'ui/b.png').unlink()
        problems = check(layout)
        self.assertEqual(len(problems), 1)
        self.assertIn('missing', problems[0])
        self.assertIn('ui/b.png', problems[0])

    def test_stray_file_is_reported(self):
        layout = self.consistent()
        (layout.out / 'ui/extra.png').write_bytes(b'x')
        problems = check(layout)
        self.assertEqual(len(problems), 1)
        self.assertIn('stray', problems[0])
        self.assertIn('ui/extra.png', problems[0])

    def test_junk_in_out_is_not_stray(self):
        layout = self.consistent()
        (layout.out / 'ui/.DS_Store').write_bytes(b'junk')
        self.assertEqual(check(layout), [])

    def test_output_never_built_is_stale(self):
        layout = self.consistent()
        lock = read_lock(layout.lock_file)
        del lock['ui/b.png']
        write_lock(layout.lock_file, lock)
        problems = check(layout)
        self.assertTrue(any('stale' in p and 'ui/b.png' in p for p in problems))

    def test_master_with_no_recipe_is_reported_by_name(self):
        layout = self.consistent()
        (layout.src / 'misc').mkdir()
        (layout.src / 'misc/lost.png').write_bytes(b'x')
        problems = check(layout)
        self.assertEqual(len(problems), 1)
        self.assertIn('misc/lost.png', problems[0])

    def test_check_imports_no_pillow(self):
        result = subprocess.run(
            [sys.executable, '-c', "import assetlib.check, sys; sys.exit('PIL' in sys.modules)"],
            cwd=str(SCRIPTS),
        )
        self.assertEqual(result.returncode, 0)


class HelperTests(unittest.TestCase):
    def test_canonical_hash_ignores_key_order(self):
        self.assertEqual(canonical_hash({'a': 1, 'b': [1, 2]}), canonical_hash({'b': [1, 2], 'a': 1}))
        self.assertNotEqual(canonical_hash({'a': 1}), canonical_hash({'a': 2}))

    def test_load_recipes_reads_the_file(self):
        layout = make_layout({}, {'ui': {'op': 'copy'}})
        self.assertEqual(load_recipes(layout.recipes_file), {'ui': {'op': 'copy'}})


if __name__ == '__main__':
    unittest.main()
