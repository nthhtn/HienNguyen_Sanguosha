"""Where the masters, recipes and generated files live."""
from dataclasses import dataclass
from pathlib import Path

# Files that are never masters, outputs or strays (macOS writes these everywhere).
IGNORED_NAMES = {'.DS_Store'}


@dataclass(frozen=True)
class Layout:
    content: Path

    @property
    def src(self) -> Path:
        return self.content / 'assets-src'

    @property
    def out(self) -> Path:
        return self.content / 'assets'

    @property
    def recipes_file(self) -> Path:
        return self.content / 'asset-recipes.json'

    @property
    def crops_file(self) -> Path:
        return self.content / 'asset-crops.json'

    @property
    def lock_file(self) -> Path:
        return self.out / 'asset-lock.json'


def default_layout() -> Layout:
    """The real layout, found from this file's own location so any working directory works."""
    return Layout(Path(__file__).resolve().parents[2] / 'projects' / 'content')
