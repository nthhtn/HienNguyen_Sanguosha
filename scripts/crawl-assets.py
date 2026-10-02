#!/usr/bin/env python3
"""Crawl base-set card-art images for every general/card already crawled as
text data under projects/content/data/. Reusable (unlike the two throwaway
scripts in this directory) -- see
docs/superpowers/specs/2026-09-24-content-asset-crawl-design.md.

For each data/**/<id>.json file, fetches its `source.url` page and looks for
the single content image (marked by class="CENy8b" on this site -- every
other <img> on the page is a duplicate of the site's own banner logo).
Downloads it into assets/, mirroring data/'s folder layout, and records an
entry in assets/manifest.json.

Never guesses: if a page doesn't have exactly one CENy8b image, it is
skipped with a warning rather than storing a possibly-wrong image.

Usage:
  scripts/crawl-assets.py              # crawl everything not yet in the manifest
  scripts/crawl-assets.py --force      # re-crawl everything, overwriting the manifest
  scripts/crawl-assets.py --only sha   # re-crawl a single id
"""
import argparse
import datetime
import json
import re
import struct
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = REPO_ROOT / "projects" / "content" / "data"
ASSETS_ROOT = REPO_ROOT / "projects" / "content" / "assets"
MANIFEST_PATH = ASSETS_ROOT / "manifest.json"

USER_AGENT = "Mozilla/5.0 (compatible; sanguosha-content-crawler/1.0)"
CONTENT_IMG_CLASS = "CENy8b"
CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read(), resp.headers.get_content_type()


def find_content_image_url(html):
    img_tags = re.findall(r"<img[^>]*>", html)
    matches = [tag for tag in img_tags if f'class="{CONTENT_IMG_CLASS}"' in tag]
    if len(matches) != 1:
        return None, len(matches)
    src_match = re.search(r'src="([^"]+)"', matches[0])
    if not src_match:
        return None, 0
    return src_match.group(1), 1


def jpeg_dimensions(data):
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        if marker == 0xD8 or marker == 0x01 or (0xD0 <= marker <= 0xD7):
            i += 2
            continue
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        i += 2 + seg_len
    return None


def png_dimensions(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def image_dimensions(data, content_type):
    try:
        if content_type == "image/jpeg":
            return jpeg_dimensions(data)
        if content_type == "image/png":
            return png_dimensions(data)
    except struct.error:
        return None
    return None


def iter_data_items():
    for json_path in sorted(DATA_ROOT.rglob("*.json")):
        item_id = json_path.stem
        rel_dir = json_path.parent.relative_to(DATA_ROOT)
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        source_url = data.get("source", {}).get("url")
        if not source_url:
            print(f"Skipping {item_id}: no source.url in {json_path}")
            continue
        yield item_id, rel_dir, source_url


def load_manifest():
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_manifest(manifest):
    ASSETS_ROOT.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def crawl_one(item_id, rel_dir, source_url):
    try:
        html_bytes, _ = fetch(source_url)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"Skipping {item_id}: failed to fetch {source_url}: {e}")
        return None
    html = html_bytes.decode("utf-8", errors="replace")

    img_url, match_count = find_content_image_url(html)
    if img_url is None:
        print(f"Skipping {item_id}: expected exactly one content image, found {match_count} ({source_url})")
        return None

    try:
        image_bytes, content_type = fetch(img_url)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"Skipping {item_id}: failed to download image: {e}")
        return None

    ext = CONTENT_TYPE_EXT.get(content_type)
    if ext is None:
        print(f"Skipping {item_id}: unrecognized image content-type {content_type!r}")
        return None

    dest_dir = ASSETS_ROOT / rel_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"{item_id}{ext}"
    dest_path.write_bytes(image_bytes)

    dims = image_dimensions(image_bytes, content_type)
    width, height = dims if dims else (None, None)

    print(f"Crawled {item_id}: {dest_path.relative_to(ASSETS_ROOT)} ({width}x{height})")
    return {
        "localPath": str(dest_path.relative_to(ASSETS_ROOT)),
        "sourceUrl": source_url,
        "crawledAt": datetime.date.today().isoformat(),
        "width": width,
        "height": height,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-crawl ids already in the manifest")
    parser.add_argument("--only", metavar="ID", help="only crawl this single id")
    args = parser.parse_args()

    manifest = load_manifest()
    crawled = 0
    skipped = 0

    for item_id, rel_dir, source_url in iter_data_items():
        if args.only and item_id != args.only:
            continue
        if item_id in manifest and not args.force:
            continue
        entry = crawl_one(item_id, rel_dir, source_url)
        if entry is None:
            skipped += 1
            continue
        manifest[item_id] = entry
        crawled += 1
        save_manifest(manifest)

    print(f"\nDone: {crawled} crawled, {skipped} skipped.")
    if skipped:
        sys.exit(1)


if __name__ == "__main__":
    main()
