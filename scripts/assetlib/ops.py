"""What the build does to make one output. Pillow is imported inside the ops that need it, never here."""
import shutil
from pathlib import Path
from typing import List, Optional

from .layout import Layout
from .plan import Output
from .recipes import load_recipes

DEFAULT_CROP_QUALITY = 92
DEFAULT_IMAGE_QUALITY = 85
DEFAULT_ALPHA_QUALITY = 100


class BuildError(Exception):
    """One output could not be made (an unreadable image, a box that does not fit); names the output."""


def _shrink(image, max_width):
    """Scale down to max_width keeping the aspect ratio (Lanczos); an image that is not wider is left alone."""
    from PIL import Image

    if max_width and image.width > max_width:
        return image.resize((max_width, max(1, round(image.height * max_width / image.width))), Image.LANCZOS)
    return image


def image_file(src: Path, dest: Path, ext: str, quality: int, alpha_quality: int, max_width: Optional[int] = None) -> None:
    """Convert a PNG or JPEG master to `ext` (webp), scaled down to max_width if given, keeping any transparency."""
    from PIL import Image  # loaded only when an image is converted

    with Image.open(src) as image:
        has_alpha = 'A' in image.getbands() or (image.mode == 'P' and 'transparency' in image.info)
        converted = _shrink(image.convert('RGBA' if has_alpha else 'RGB'), max_width)
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    converted.save(dest, ext.upper(), quality=quality, alpha_quality=alpha_quality, method=5)


def crop_file(src: Path, dest: Path, box: List[int], quality: int, ext: str = 'jpg', max_width: Optional[int] = None) -> None:
    """Cut box = [x, y, width, height] (pixels of the full image) out of src, scale it down to max_width if given,
    and save it as a JPEG (ext jpg) or WebP."""
    from PIL import Image  # loaded only when a crop is built

    x, y, w, h = box
    with Image.open(src) as image:
        if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > image.width or y + h > image.height:
            raise ValueError('crop box {} does not fit {} ({}x{})'.format(box, src, image.width, image.height))
        cut = _shrink(image.convert('RGB').crop((x, y, x + w, y + h)), max_width)
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    if ext == 'webp':
        cut.save(dest, 'WEBP', quality=quality, method=5)
    else:
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
        image_file(layout.src / output.sources[0], dest, recipe['ext'], recipe.get('quality', DEFAULT_IMAGE_QUALITY), recipe.get('alphaQuality', DEFAULT_ALPHA_QUALITY), recipe.get('maxWidth'))
    elif output.op == 'crop':
        recipe = load_recipes(layout.recipes_file)[output.recipe_key]
        crop_file(layout.src / output.sources[0], dest, output.settings['box'], recipe.get('quality', DEFAULT_CROP_QUALITY), recipe['ext'], recipe.get('maxWidth'))
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
