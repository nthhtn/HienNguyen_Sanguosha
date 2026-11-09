"""What the recipes produce from the masters. Standard library only: planning never opens an image."""
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

from .layout import IGNORED_NAMES, Layout
from .lockfile import sha256_file
from .recipes import NoRecipe, canonical_hash, load_recipes, recipe_for


# What the image op reads, and the formats it can write.
IMAGE_SOURCES = {'png', 'jpg', 'jpeg'}
IMAGE_TARGETS = {'webp'}
CROP_TARGETS = {'jpg', 'webp'}
SHEET_TARGETS = {'png', 'webp'}
VIDEO_SOURCES = {'mp4', 'mov', 'webm'}
VIDEO_TARGETS = {'mp4'}
X264_PRESETS = {'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'}


class PlanError(Exception):
    pass


@dataclass(frozen=True)
class Output:
    path: str  # relative to assets/
    op: str  # copy | image | video | crop | sheet | sheets-meta
    sources: Tuple[str, ...]  # relative to assets-src/
    recipe_key: str
    settings: dict = field(default_factory=dict)  # per-output extras: the crop box, the sheet id and folder


def files_under(base: Path) -> List[str]:
    """Every file below base (posix paths relative to it), junk files left out, in a stable order."""
    base = Path(base)
    if not base.exists():
        return []
    return [p.relative_to(base).as_posix() for p in sorted(base.rglob('*')) if p.is_file() and p.name not in IGNORED_NAMES]


def _copy_outputs(layout: Layout, recipes: Dict[str, dict]) -> List[Output]:
    outputs: List[Output] = []
    by_stem: Dict[Tuple[str, str], List[str]] = {}
    for rel in files_under(layout.src):
        try:
            key, recipe = recipe_for(recipes, rel)
        except NoRecipe:
            raise PlanError('no recipe for master {}'.format(rel))
        op = recipe['op']
        if op == 'master-only':
            continue
        if op not in ('copy', 'image', 'video'):
            raise PlanError('master {} falls under the {} recipe {}, which builds its own files'.format(rel, op, key))
        path = Path(rel)
        suffix = path.suffix.lstrip('.').lower()
        ext = recipe.get('ext')
        if op == 'copy':
            if ext and suffix != ext:
                raise PlanError('master {} does not have the extension {} that recipe {} ships (it copies, so the extension cannot change)'.format(rel, ext, key))
            target = rel
        elif op == 'image':
            if suffix not in IMAGE_SOURCES:
                raise PlanError('master {} is not a PNG or JPEG image, which is what recipe {} converts'.format(rel, key))
            target = path.with_suffix('.' + ext).as_posix()
        else:
            if suffix not in VIDEO_SOURCES:
                raise PlanError('master {} is not an mp4, mov or webm video, which is what recipe {} converts'.format(rel, key))
            target = path.with_suffix('.' + ext).as_posix()
        by_stem.setdefault((path.parent.as_posix(), path.stem), []).append(rel)
        outputs.append(Output(target, op, (rel,), key))
    for names in by_stem.values():
        if len(names) > 1:
            raise PlanError('ambiguous masters {}: a reference without extension cannot tell them apart'.format(' and '.join(names)))
    return outputs


def _is_box(box) -> bool:
    if not isinstance(box, list) or len(box) != 4 or not all(isinstance(n, int) and not isinstance(n, bool) for n in box):
        return False
    x, y, w, h = box
    return x >= 0 and y >= 0 and w > 0 and h > 0


def _crop_outputs(layout: Layout, key: str, recipe: dict) -> List[Output]:
    from_dir = recipe['from']
    boxes = json.loads(layout.crops_file.read_text()) if layout.crops_file.exists() else {}
    full = {Path(rel).with_suffix('').as_posix(): '{}/{}'.format(from_dir, rel) for rel in files_under(layout.src / from_dir)}
    for card, box in boxes.items():
        if card not in full:
            raise PlanError('crop box for {} has no full art in {}'.format(card, from_dir))
        if not _is_box(box):
            raise PlanError('crop box for {} must be [x, y, width, height] as whole numbers with x, y >= 0 and width, height > 0, not {!r}'.format(card, box))
    for card in full:
        if card not in boxes:
            raise PlanError('full art {} has no crop box in asset-crops.json'.format(card))
    return [Output('{}/{}.{}'.format(key, card, recipe['ext']), 'crop', (full[card],), key, {'box': boxes[card]}) for card in sorted(full)]


def _frames(layout: Layout, from_dir: str, folder: str) -> List[str]:
    base = layout.src / from_dir / folder
    names = [p.name for p in base.iterdir() if p.suffix == '.png'] if base.is_dir() else []
    names.sort(key=lambda n: (int(Path(n).stem) if Path(n).stem.isdigit() else 10 ** 9, n))
    return ['{}/{}/{}'.format(from_dir, folder, n) for n in names]


def _sheet_outputs(layout: Layout, key: str, recipe: dict) -> List[Output]:
    outputs: List[Output] = []
    everything: List[str] = []
    for effect, folder in recipe['map'].items():
        frames = _frames(layout, recipe['from'], folder)
        if not frames:
            raise PlanError('no frames for {} in {}/{}'.format(effect, recipe['from'], folder))
        everything.extend(frames)
        outputs.append(Output('{}/{}.{}'.format(key, effect, recipe.get('ext', 'png')), 'sheet', tuple(frames), key, {'id': effect, 'folder': folder}))
    outputs.append(Output('{}/sheets.json'.format(key), 'sheets-meta', tuple(everything), key, {'map': recipe['map']}))
    return outputs


def plan_outputs(layout: Layout) -> List[Output]:
    recipes = load_recipes(layout.recipes_file)
    for key, recipe in recipes.items():
        if recipe['op'] in ('image', 'crop', 'video') and 'maxWidth' in recipe:
            width = recipe['maxWidth']
            if not isinstance(width, int) or isinstance(width, bool) or width <= 0:
                raise PlanError('recipe {}: maxWidth must be a positive whole number, not {!r}'.format(key, width))
        if recipe['op'] == 'crop' and recipe.get('ext') not in CROP_TARGETS:
            raise PlanError('recipe {} cannot write {!r}: a crop is saved as {}'.format(key, recipe.get('ext'), ' or '.join(sorted(CROP_TARGETS))))
        if recipe['op'] == 'video':
            if recipe.get('ext') not in VIDEO_TARGETS:
                raise PlanError('recipe {} cannot write {!r}: the video op writes {}'.format(key, recipe.get('ext'), ' or '.join(sorted(VIDEO_TARGETS))))
            for field, low, high in (('fps', 1, None), ('crf', 0, 51)):
                if field in recipe:
                    value = recipe[field]
                    if not isinstance(value, int) or isinstance(value, bool) or value < low or (high is not None and value > high):
                        raise PlanError('recipe {}: {} must be a whole number from {}{}, not {!r}'.format(key, field, low, ' to {}'.format(high) if high is not None else ' up', value))
            if 'preset' in recipe and recipe['preset'] not in X264_PRESETS:
                raise PlanError('recipe {}: preset must be one of {}, not {!r}'.format(key, ', '.join(sorted(X264_PRESETS)), recipe['preset']))
        if recipe['op'] == 'sheets' and recipe.get('ext', 'png') not in SHEET_TARGETS:
            raise PlanError('recipe {} cannot write {!r}: a sheet is saved as {}'.format(key, recipe.get('ext'), ' or '.join(sorted(SHEET_TARGETS))))
        if recipe['op'] == 'image' and recipe.get('ext') not in IMAGE_TARGETS:
            raise PlanError('recipe {} cannot write {!r}: the image op writes {}'.format(key, recipe.get('ext'), ' or '.join(sorted(IMAGE_TARGETS))))
    outputs = _copy_outputs(layout, recipes)
    for key, recipe in recipes.items():
        if recipe['op'] == 'crop':
            outputs.extend(_crop_outputs(layout, key, recipe))
        elif recipe['op'] == 'sheets':
            outputs.extend(_sheet_outputs(layout, key, recipe))
    seen: Dict[str, str] = {}
    for output in outputs:
        if output.path in seen:
            raise PlanError('two recipes produce {}'.format(output.path))
        seen[output.path] = output.recipe_key
    return sorted(outputs, key=lambda o: o.path)


def inputs_of(layout: Layout, output: Output) -> dict:
    """What an output depends on: the hash of each master and of its recipe and extras."""
    recipe = load_recipes(layout.recipes_file)[output.recipe_key]
    return {
        'sources': {src: sha256_file(layout.src / src) for src in output.sources},
        'settings': canonical_hash({'op': output.op, 'recipe': recipe, 'extra': output.settings}),
    }
