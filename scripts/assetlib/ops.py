"""What the build does to make one output. Pillow is imported inside the ops that need it, never here."""
import shutil

from .layout import Layout
from .plan import Output


def run(layout: Layout, output: Output) -> None:
    dest = layout.out / output.path
    dest.parent.mkdir(parents=True, exist_ok=True)
    if output.op == 'copy':
        shutil.copyfile(layout.src / output.sources[0], dest)
    else:
        raise ValueError('unknown op {} for {}'.format(output.op, output.path))
