#!/usr/bin/env python3
"""Crawl General portraits (the large "cover" art) from https://www.sanguosha.com/hero.

The hero page embeds the whole roster as a `const Listdata = {...}` JSON object,
grouped by expansion ("国战", "标准", ...). Each entry has a gid, name, force and
a `cover` URL (750x950 PNG). Portraits are saved to
projects/content/assets/generals/portraits/<id>.png (an English id such as cao-cao,
looked up by gid in scripts/portrait-ids.json; a General with no id there falls back
to the site's Chinese name, "<name>-<gid>.png" if that is taken) and recorded in
projects/content/assets/generals/portraits/manifest.json (safe to commit; the
PNGs are gitignored -- they are commercial art, see assets/README.md).

Usage:
  scripts/crawl-portraits.py                 # the 国战 (Guozhan) group
  scripts/crawl-portraits.py --group 标准     # another group
  scripts/crawl-portraits.py --all           # every group (~650 MB)
  scripts/crawl-portraits.py --force         # re-download files already present
"""
import argparse
import datetime
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

PAGE_URL = "https://www.sanguosha.com/hero"
USER_AGENT = "Mozilla/5.0 (compatible; sanguosha-content-crawler/1.0)"
IDS_PATH = Path(__file__).resolve().parent / "portrait-ids.json"
OUT_DIR = Path(__file__).resolve().parent.parent / "projects/content/assets/generals/portraits"
MANIFEST_PATH = OUT_DIR / "manifest.json"
DELAY_SECONDS = 0.3


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read(), resp.headers.get_content_type()


def file_name(hero, manifest):
    """The General's English id, else its Chinese name made unique by its gid."""
    gid = str(hero["gid"])
    ids = json.loads(IDS_PATH.read_text(encoding="utf-8"))
    if gid in ids:
        return f"{ids[gid]}.png"
    taken = {v["file"] for k, v in manifest.items() if k != gid}
    name = f"{hero['name']}.png"
    return name if name not in taken else f"{hero['name']}-{gid}.png"


def load_roster():
    html = fetch(PAGE_URL)[0].decode("utf-8")
    match = re.search(r"const Listdata = ", html)
    if not match:
        sys.exit("Listdata not found on the hero page; the site layout has changed")
    roster, _ = json.JSONDecoder().raw_decode(html[match.end():])
    return roster


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--group", default="国战")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    roster = load_roster()
    groups = list(roster) if args.all else [args.group]
    for group in groups:
        if group not in roster:
            sys.exit(f"unknown group {group!r}; choose from {', '.join(roster)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}
    today = datetime.date.today().isoformat()
    failed = []
    for group in groups:
        for hero in roster[group]:
            gid = str(hero["gid"])
            file = manifest[gid]["file"] if gid in manifest else file_name(hero, manifest)
            path = OUT_DIR / file
            if path.exists() and gid in manifest and not args.force:
                continue
            try:
                data, content_type = fetch(hero["cover"])
                if content_type != "image/png":
                    raise ValueError(f"unexpected content type {content_type}")
            except Exception as err:  # noqa: BLE001 -- report and keep going
                print(f"skip {gid} {hero['name']}: {err}", file=sys.stderr)
                failed.append(gid)
                continue
            path.write_bytes(data)
            manifest[gid] = {
                "name": hero["name"],
                "file": file,
                "group": group,
                "force": hero["figure"],
                "sourceUrl": hero["cover"],
                "crawledAt": today,
                "bytes": len(data),
            }
            print(f"ok   {gid} {hero['name']} ({len(data) // 1024} KB)")
            time.sleep(DELAY_SECONDS)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    print(f"done: {len(manifest)} in manifest, {len(failed)} failed")


if __name__ == "__main__":
    main()
