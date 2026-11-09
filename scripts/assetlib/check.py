"""Is assets/ up to date? Compares the plan with the lock; never builds. Standard library only."""
from typing import List

from .layout import Layout
from .lockfile import read_lock, sha256_file
from .plan import PlanError, files_under, inputs_of, plan_outputs

LOCK_NAME = 'asset-lock.json'


def _what_changed(locked: dict, current: dict) -> str:
    """Name one master that differs: edited, newly added, or removed since the lock was written."""
    for src, sha in current.items():
        if src not in locked:
            return 'master {} was added'.format(src)
        if locked[src] != sha:
            return 'master {} changed'.format(src)
    removed = sorted(set(locked) - set(current))
    return 'master {} was removed'.format(removed[0])


def check(layout: Layout) -> List[str]:
    try:
        outputs = plan_outputs(layout)
    except PlanError as error:
        return ['plan: {}'.format(error)]
    lock = read_lock(layout.lock_file)
    problems: List[str] = []
    planned = set()
    for output in outputs:
        planned.add(output.path)
        entry = lock.get(output.path)
        if entry is None:
            problems.append('stale: {} is not in the lock (never built)'.format(output.path))
            continue
        inputs = inputs_of(layout, output)
        locked = entry.get('sources', {})
        if locked != inputs['sources']:
            problems.append('stale: {} ({})'.format(output.path, _what_changed(locked, inputs['sources'])))
            continue
        if entry.get('settings') != inputs['settings']:
            problems.append('stale: {} (recipe {} changed)'.format(output.path, output.recipe_key))
            continue
        built = layout.out / output.path
        if not built.is_file():
            problems.append('missing: {} is not in assets/'.format(output.path))
        elif sha256_file(built) != entry.get('output'):
            problems.append('edited: {} differs from the lock (edit the master instead)'.format(output.path))
    for path in sorted(set(lock) - planned):
        problems.append('stale: the lock lists {}, which no recipe produces'.format(path))
    for rel in files_under(layout.out):
        if rel != LOCK_NAME and rel not in planned:
            problems.append('stray: {} is not produced by any recipe'.format(rel))
    return problems
