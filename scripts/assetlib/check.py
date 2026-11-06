"""Is assets/ up to date? Compares the plan with the lock; never builds. Standard library only."""
from typing import List

from .layout import Layout
from .lockfile import read_lock, sha256_file
from .plan import PlanError, files_under, inputs_of, plan_outputs

LOCK_NAME = 'asset-lock.json'


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
        changed = [src for src, sha in inputs['sources'].items() if entry.get('sources', {}).get(src) != sha]
        if changed:
            problems.append('stale: {} (master {} changed)'.format(output.path, changed[0]))
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
