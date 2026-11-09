"""Builds assets/ from assets-src/, rewriting only outputs whose inputs changed."""
from dataclasses import dataclass

from . import ops
from .check import LOCK_NAME
from .layout import Layout
from .lockfile import read_lock, sha256_file, write_lock
from .plan import files_under, inputs_of, plan_outputs


@dataclass
class BuildReport:
    built: int = 0
    skipped: int = 0
    removed: int = 0


def build(layout: Layout) -> BuildReport:
    outputs = plan_outputs(layout)
    lock = read_lock(layout.lock_file)
    entries = {}
    report = BuildReport()
    layout.out.mkdir(parents=True, exist_ok=True)
    for output in outputs:
        inputs = inputs_of(layout, output)
        entry = lock.get(output.path)
        built = layout.out / output.path
        fresh = (
            entry is not None
            and entry.get('sources') == inputs['sources']
            and entry.get('settings') == inputs['settings']
            and built.is_file()
            and sha256_file(built) == entry.get('output')
        )
        if fresh:
            entries[output.path] = entry
            report.skipped += 1
            continue
        ops.run(layout, output)
        entries[output.path] = {**inputs, 'output': sha256_file(built)}
        report.built += 1
    planned = {output.path for output in outputs}
    for rel in files_under(layout.out):
        if rel != LOCK_NAME and rel not in planned:
            (layout.out / rel).unlink()
            report.removed += 1
    for folder in sorted((p for p in layout.out.rglob('*') if p.is_dir()), reverse=True):
        if not any(folder.iterdir()):
            folder.rmdir()
    write_lock(layout.lock_file, entries)
    return report
