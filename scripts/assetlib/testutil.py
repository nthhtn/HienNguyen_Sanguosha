"""Helpers shared by the pipeline tests."""
import json
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Optional

from assetlib.layout import Layout
from assetlib.lockfile import sha256_file, write_lock
from assetlib.plan import inputs_of, plan_outputs


def make_layout(files: Dict[str, bytes], recipes: dict, crops: Optional[dict] = None) -> Layout:
    content = Path(tempfile.mkdtemp())
    layout = Layout(content)
    for rel, data in files.items():
        path = layout.src / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    layout.recipes_file.write_text(json.dumps(recipes))
    layout.crops_file.write_text(json.dumps(crops or {}))
    return layout


def build_by_hand(layout: Layout) -> None:
    """Copy every planned output and write a consistent lock (copy recipes only)."""
    entries = {}
    for output in plan_outputs(layout):
        dest = layout.out / output.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(layout.src / output.sources[0], dest)
        inputs = inputs_of(layout, output)
        entries[output.path] = {**inputs, 'output': sha256_file(dest)}
    write_lock(layout.lock_file, entries)
