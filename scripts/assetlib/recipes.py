"""Recipes: one entry per folder (or file) of masters, saying what the build does with it."""
import hashlib
import json
from pathlib import Path
from typing import Dict, Tuple


class NoRecipe(Exception):
    pass


def load_recipes(path: Path) -> Dict[str, dict]:
    return json.loads(Path(path).read_text())


def recipe_for(recipes: Dict[str, dict], rel_path: str) -> Tuple[str, dict]:
    """The recipe whose key is the path itself or the longest whole-folder prefix of it."""
    best = None
    for key in recipes:
        if rel_path == key or rel_path.startswith(key + '/'):
            if best is None or len(key) > len(best):
                best = key
    if best is None:
        raise NoRecipe(rel_path)
    return best, recipes[best]


def canonical_hash(obj) -> str:
    text = json.dumps(obj, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(text.encode('utf-8')).hexdigest()
