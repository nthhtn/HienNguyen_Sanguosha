"""What the build does to make one output. Pillow is imported inside the ops that need it, never here."""
import shutil
from pathlib import Path
from typing import List

from .layout import Layout
from .plan import Output
from .recipes import load_recipes

DEFAULT_CROP_QUALITY = 92
DEFAULT_IMAGE_QUALITY = 85
DEFAULT_ALPHA_QUALITY = 100


class BuildError(Exception):
    """One output could not be made (an unreadable image, a box that does not fit); names the output."""


def image_file(src: Path, dest: Path, ext: str, quality: int, alpha_quality: int) -> None:
    """Convert a PNG or JPEG master to `ext` (webp), keeping its size and any transparency."""
    from PIL import Image  # loaded only when an image is converted

    with Image.open(src) as image:
        has_alpha = 'A' in image.getbands() or (image.mode == 'P' and 'transparency' in image.info)
        converted = image.convert('RGBA' if has_alpha else 'RGB')
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    converted.save(dest, ext.upper(), quality=quality, alpha_quality=alpha_quality, method=5)


def crop_file(src: Path, dest: Path, box: List[int], quality: int) -> None:
    """Cut box = [x, y, width, height] (pixels of the full image) out of src and save it as a JPEG."""
    from PIL import Image  # loaded only when a crop is built

    x, y, w, h = box
    with Image.open(src) as image:
        if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > image.width or y + h > image.height:
            raise ValueError('crop box {} does not fit {} ({}x{})'.format(box, src, image.width, image.height))
        cut = image.convert('RGB').crop((x, y, x + w, y + h))
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    cut.save(dest, 'JPEG', quality=quality)


def run(layout: Layout, output: Output) -> None:
    try:
        _run(layout, output)
    except (ValueError, OSError) as error:
        raise BuildError('{}: {}'.format(output.path, error)) from error


def _run(layout: Layout, output: Output) -> None:
    dest = layout.out / output.path
    dest.parent.mkdir(parents=True, exist_ok=True)
    if output.op == 'copy':
        shutil.copyfile(layout.src / output.sources[0], dest)
    elif output.op == 'image':
        recipe = load_recipes(layout.recipes_file)[output.recipe_key]
        image_file(layout.src / output.sources[0], dest, recipe['ext'], recipe.get('quality', DEFAULT_IMAGE_QUALITY), recipe.get('alphaQuality', DEFAULT_ALPHA_QUALITY))
    elif output.op == 'crop':
        quality = load_recipes(layout.recipes_file)[output.recipe_key].get('quality', DEFAULT_CROP_QUALITY)
        crop_file(layout.src / output.sources[0], dest, output.settings['box'], quality)
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
