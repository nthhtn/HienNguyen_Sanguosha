import io
import json
import unittest

from PIL import Image

from assetlib.build import build
from assetlib.check import check
from assetlib.plan import PlanError, plan_outputs
from assetlib.testutil import make_layout

INDEX_PATH = 'generals/skins/art-sets.json'
SKINS = {'cao-cao': 'wei/caocao', 'guan-yu': 'shu/guanyu'}
REGISTRY = {
    'classic': {'names': {'en': 'Classic', 'vi': 'Cổ điển'}, 'provenance': {'en': 'Original portraits', 'vi': 'Chân dung gốc'}},
    'ink': {'names': {'en': 'Ink Wash', 'vi': 'Thủy mặc'}, 'provenance': {'en': 'Example set', 'vi': 'Bộ ví dụ'}},
}
BOXES = {'classic/wei/caocao': [2, 3, 4, 4], 'classic/shu/guanyu': [2, 3, 4, 4], 'ink/wei/caocao': [2, 3, 4, 4]}


def recipes(optional=True):
    faces = {'op': 'crop', 'from': 'generals/skins', 'boxes': 'faces.json', 'ext': 'webp', 'quality': 85}
    if optional:
        faces['boxesOptional'] = True
    return {
        'generals/skins': {'op': 'copy'},
        'generals/skins/skins.json': {'op': 'copy'},
        'generals/skins/sets.json': {'op': 'master-only'},
        'generals/faces': faces,
        INDEX_PATH: {'op': 'art-sets', 'skins': 'generals/skins', 'faces': 'generals/faces', 'registry': 'generals/skins/sets.json'},
    }


def png() -> bytes:
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), (255, 255, 255)).save(buffer, 'PNG')
    return buffer.getvalue()


def make(extra=None, registry=None, boxes=None, skins=None, optional=True, art=b'x'):
    files = {
        'generals/skins/skins.json': json.dumps(SKINS if skins is None else skins).encode(),
        'generals/skins/sets.json': json.dumps(REGISTRY if registry is None else registry).encode(),
        'generals/skins/classic/wei/caocao.png': art,
        'generals/skins/classic/shu/guanyu.png': art,
        'generals/skins/ink/wei/caocao.png': art,
    }
    files.update(extra or {})
    layout = make_layout(files, recipes(optional))
    (layout.content / 'faces.json').write_text(json.dumps(BOXES if boxes is None else boxes))
    return layout


def index_of(layout):
    return [o for o in plan_outputs(layout) if o.op == 'art-sets'][0].settings['index']


class OptionalFaceBoxes(unittest.TestCase):
    def test_art_without_a_box_is_skipped_when_boxes_are_optional(self):
        layout = make(boxes={'classic/wei/caocao': [2, 3, 4, 4], 'classic/shu/guanyu': [2, 3, 4, 4]})
        faces = [o.path for o in plan_outputs(layout) if o.op == 'crop']
        self.assertEqual(faces, ['generals/faces/classic/shu/guanyu.webp', 'generals/faces/classic/wei/caocao.webp'])

    def test_art_without_a_box_still_fails_without_the_flag(self):
        layout = make(optional=False, boxes={'classic/wei/caocao': [2, 3, 4, 4], 'classic/shu/guanyu': [2, 3, 4, 4]})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('has no crop box', str(ctx.exception))


class ArtSetsIndex(unittest.TestCase):
    def test_index_lists_portraits_and_faces_per_set_by_general_id(self):
        classic = index_of(make())['sets']['classic']
        self.assertEqual((classic['portraits'], classic['faces']), (['cao-cao', 'guan-yu'], ['cao-cao', 'guan-yu']))
        ink = index_of(make(boxes={'classic/wei/caocao': [2, 3, 4, 4], 'classic/shu/guanyu': [2, 3, 4, 4]}))['sets']['ink']
        self.assertEqual((ink['portraits'], ink['faces']), (['cao-cao'], []))

    def test_index_carries_names_and_provenance_in_registry_order(self):
        index = index_of(make())
        self.assertEqual(index['order'], ['classic', 'ink'])
        self.assertEqual(index['sets']['ink']['names'], {'en': 'Ink Wash', 'vi': 'Thủy mặc'})
        self.assertEqual(index['sets']['ink']['provenance'], {'en': 'Example set', 'vi': 'Bộ ví dụ'})

    def test_a_set_folder_without_a_registry_entry_fails(self):
        layout = make(extra={'generals/skins/studio/wei/caocao.png': b'x'}, boxes=dict(BOXES, **{'studio/wei/caocao': [2, 3, 4, 4]}))
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('studio', str(ctx.exception))

    def test_a_registry_entry_without_a_folder_fails(self):
        registry = dict(REGISTRY, ghost={'names': {'en': 'Ghost', 'vi': 'Ma'}, 'provenance': {'en': 'none', 'vi': 'không'}})
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(make(registry=registry))
        self.assertIn('ghost', str(ctx.exception))

    def test_a_registry_entry_needs_names_and_provenance_in_both_languages(self):
        for field, broken in (('names', {'en': 'Ink Wash'}), ('provenance', {'en': 'Example set', 'vi': ''}), ('provenance', 'Example set')):
            registry = {**REGISTRY, 'ink': {**REGISTRY['ink'], field: broken}}
            with self.assertRaises(PlanError) as ctx:
                plan_outputs(make(registry=registry))
            self.assertIn('ink', str(ctx.exception))
            self.assertIn(field, str(ctx.exception))

    def test_a_skin_not_in_skins_json_fails(self):
        layout = make(extra={'generals/skins/ink/wu/sunquan.png': b'x'}, boxes=dict(BOXES, **{'ink/wu/sunquan': [2, 3, 4, 4]}))
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('ink/wu/sunquan', str(ctx.exception))

    def test_classic_must_cover_every_general_in_skins_json(self):
        layout = make(skins=dict(SKINS, **{'zhang-fei': 'shu/zhangfei'}))
        with self.assertRaises(PlanError) as ctx:
            plan_outputs(layout)
        self.assertIn('zhang-fei', str(ctx.exception))

    def test_build_writes_the_index_and_check_passes(self):
        layout = make(art=png())
        build(layout)
        written = json.loads((layout.out / INDEX_PATH).read_text())
        self.assertEqual(written['sets']['classic']['faces'], ['cao-cao', 'guan-yu'])
        self.assertEqual(check(layout), [])

    def test_a_new_face_box_makes_the_index_stale(self):
        layout = make(art=png(), boxes={'classic/wei/caocao': [2, 3, 4, 4], 'classic/shu/guanyu': [2, 3, 4, 4]})
        build(layout)
        (layout.content / 'faces.json').write_text(json.dumps(BOXES))
        self.assertTrue(any(p.startswith('stale: ' + INDEX_PATH) for p in check(layout)), check(layout))


if __name__ == '__main__':
    unittest.main()
