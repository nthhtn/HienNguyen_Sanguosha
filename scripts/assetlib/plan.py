"""What the recipes produce from the masters. Standard library only: planning never opens an image."""
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

from .layout import IGNORED_NAMES, Layout
from .lockfile import sha256_file
from .recipes import NoRecipe, canonical_hash, load_recipes, recipe_for


class PlanError(Exception):
    pass


@dataclass(frozen=True)
class Output:
    path: str  # relative to assets/
    op: str  # copy | crop | sheet | sheets-meta
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
        if op != 'copy':
            raise PlanError('master {} falls under the {} recipe {}, which builds its own files'.format(rel, op, key))
        ext = recipe.get('ext')
        if ext and Path(rel).suffix.lstrip('.').lower() != ext:
            raise PlanError('master {} does not have the extension {} that recipe {} ships (this stage only copies)'.format(rel, ext, key))
        path = Path(rel)
        by_stem.setdefault((path.parent.as_posix(), path.stem), []).append(rel)
        outputs.append(Output(rel, 'copy', (rel,), key))
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
        outputs.append(Output('{}/{}.png'.format(key, effect), 'sheet', tuple(frames), key, {'id': effect, 'folder': folder}))
    outputs.append(Output('{}/sheets.json'.format(key), 'sheets-meta', tuple(everything), key, {'map': recipe['map']}))
    return outputs


def plan_outputs(layout: Layout) -> List[Output]:
    recipes = load_recipes(layout.recipes_file)
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
