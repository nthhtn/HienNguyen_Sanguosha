"""The lock: for every generated file, the hashes of its inputs and of itself."""
import hashlib
import json
from pathlib import Path
from typing import Dict


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_lock(path: Path) -> Dict[str, dict]:
    path = Path(path)
    return json.loads(path.read_text()) if path.exists() else {}


def write_lock(path: Path, entries: Dict[str, dict]) -> None:
    """Deterministic and merge-friendly: sorted keys, two-space indent, LF, trailing newline, no timestamps."""
    text = json.dumps(entries, indent=2, sort_keys=True, ensure_ascii=False) + '\n'
    with open(path, 'w', newline='\n') as handle:
        handle.write(text)
