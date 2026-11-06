"""What the build does to make one output. Pillow is imported inside the ops that need it, never here."""
import shutil

from .layout import Layout
from .plan import Output
from .recipes import load_recipes


def run(layout: Layout, output: Output) -> None:
    dest = layout.out / output.path
    dest.parent.mkdir(parents=True, exist_ok=True)
    if output.op == 'copy':
        shutil.copyfile(layout.src / output.sources[0], dest)
    elif output.op == 'sheet':
        from . import sheets  # Pillow, loaded only when a sheet is built

        sheets.build_sheet((layout.src / output.sources[0]).parent, dest)
    elif output.op == 'sheets-meta':
        from . import sheets

        recipe = load_recipes(layout.recipes_file)[output.recipe_key]
        frames_root = layout.src / recipe['from']
        manifest = {effect: sheets.sheet_meta(frames_root / folder) for effect, folder in recipe['map'].items()}
        with open(dest, 'w', newline='\n') as handle:
            handle.write(sheets.sheets_json(manifest))
    else:
        raise ValueError('unknown op {} for {}'.format(output.op, output.path))
