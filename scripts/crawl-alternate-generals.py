#!/usr/bin/env python3
"""Crawl the Alternate deck's Generals (Kingdom War) from the KW Characters blog
index and the 60 General pages it links to.
See docs/superpowers/specs/2026-10-21-alternate-generals-crawl-design.md.

Writes into projects/content/data/decks/alternate/:

  generals/<force>/<id>.json   one record per General (skills, partners, source)
  diff-vs-default.md           a marked Generals block is added to the card report

HP and gender are not on the pages: they are copied from Default's General when
one matches, and left out otherwise. Nothing in the game reads these files yet,
and Default's data is never edited.

Never guesses: a page that cannot be read is reported and skipped (exit code 0).

Usage:
  scripts/crawl-alternate-generals.py                  # fetch the live blog
  scripts/crawl-alternate-generals.py --file index.html --pages DIR   # saved copies, no network
"""
import argparse
import datetime
import glob
import html as htmllib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL = "https://sanguoshaenglish.blogspot.com/2010/02/kw-characters.html"
SITE = "English Sanguosha blog (KW Characters)"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_GENERALS = ROOT / "projects/content/data/generals"
OUT_DIR = ROOT / "projects/content/data/decks/alternate"
CACHE_DIR = ROOT / "tmp/generals-cache"

ANCHOR_FORCE = {"shu": "shu", "wei": "wei", "wu": "wu", "heroes": "qun"}
POST_BODY_START = "post-body entry-content"
POST_BODY_END = "post-share-buttons"


class GeneralError(Exception):
    pass


# ---------------------------------------------------------------- index page

def post_body(html):
    """The post body only: from its opening div to the share buttons, so the
    blog's comments never enter the data."""
    start = html.find(POST_BODY_START)
    if start < 0:
        raise GeneralError("no post body")
    start = html.find(">", start) + 1
    end = html.find(POST_BODY_END, start)
    return html[start:end if end >= 0 else len(html)]


class IndexParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.anchor = None
        self.href = None
        self.entries = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("name"):
            self.anchor = a["name"]
        elif tag == "a" and a.get("href"):
            self.href = a["href"]
        elif tag == "img" and self.href and self.anchor in ANCHOR_FORCE:
            slug = self.href.rstrip("/").rsplit("/", 1)[-1]
            slug = slug[:-5] if slug.endswith(".html") else slug
            self.entries.append({"force": ANCHOR_FORCE[self.anchor], "url": self.href, "slug": slug})

    def handle_endtag(self, tag):
        if tag == "a":
            self.href = None


def parse_index(html):
    """The Generals the index lists, in page order: {force, url, slug}."""
    p = IndexParser()
    p.feed(post_body(html))
    return p.entries


# ------------------------------------------------------------- General pages

CJK = re.compile(r"[\u4e00-\u9fff]+")
QUOTES = "\"'\u201c\u201d\u2018\u2019 "
LABEL = re.compile(
    r"^(translated description|who is he|who is she|who are they|character ability(?: *\d+)?|"
    r"synergistic partners|difference from normal sanguosha|ability's relation to story|trivia)"
    r" *:(.*)$",
    re.I,
)


class LineParser(HTMLParser):
    """The post body as text lines: <br> and block ends break a line."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines = [""]
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        elif tag == "br":
            self.lines.append("")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
        elif tag in ("div", "p", "li", "h1", "h2", "h3"):
            self.lines.append("")

    def handle_data(self, data):
        if not self.skip:
            self.lines[-1] += data


def body_lines(html):
    p = LineParser()
    p.feed(post_body(html))
    return [" ".join(l.replace("\xa0", " ").split()) for l in p.lines if l.strip()]


def strip_diacritics(text):
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def page_names(html):
    """(name, nameZh) from the page title, e.g. "Liú Bèi 刘备 ~ 三国杀! ..."."""
    m = re.search(r"<title>(.*?)</title>", html, re.S)
    if not m:
        raise GeneralError("no page title")
    head = htmllib.unescape(m.group(1)).split("~")[0]
    name_zh = "".join(CJK.findall(head))
    name = " ".join(strip_diacritics(CJK.sub(" ", head)).split()).strip("& ")
    if not name:
        raise GeneralError("no English name in the page title")
    return name, name_zh or None


def parse_skill(rest, lines):
    tag = re.search(r"\[([^\]]+)\]", rest)
    if tag:
        rest = rest.replace(tag.group(0), "")
    rest = rest.strip(QUOTES)
    zh = CJK.search(rest)
    name = (rest[: zh.start()] if zh else rest.split("(")[0]).strip(QUOTES + "(")
    if not name or not lines:
        raise GeneralError(f"a skill label without a name or text: {rest!r}")
    skill = {"name": name}
    if zh:
        skill["nameZh"] = zh.group(0)
    skill["text"] = "\n".join(lines)
    if tag:
        skill["tag"] = tag.group(1).strip()
    return skill


def parse_general(html):
    """A General page: name, nameZh, title, skills, synergisticPartners,
    differenceFromNormal. Raises GeneralError when no skill can be read."""
    name, name_zh = page_names(html)
    sections = []  # (label, rest-of-line, following lines)
    for line in body_lines(html):
        m = LABEL.match(line)
        if m:
            sections.append((" ".join(m.group(1).lower().split()), m.group(2).strip(), []))
        elif sections:
            sections[-1][2].append(line)

    skills = [parse_skill(rest, lines) for label, rest, lines in sections if label.startswith("character ability")]
    if not skills:
        raise GeneralError("no Character ability on the page")

    def section(label):
        for lab, rest, lines in sections:
            if lab == label:
                return ([rest] if rest else []) + lines
        return None

    desc = section("translated description")
    title = None
    if desc:
        head = CJK.split(desc[0])[0]
        title = head.strip(QUOTES + "(") or None
    partners = section("synergistic partners") or []
    partners = [p for p in partners if p.strip(" .").lower() not in ("nil", "none", "-")]
    difference = section("difference from normal sanguosha")
    return {
        "name": name,
        "nameZh": name_zh,
        "title": title,
        "skills": skills,
        "synergisticPartners": partners,
        "differenceFromNormal": "\n".join(difference) if difference else None,
    }


# ------------------------------------------------------------ Default's data

def load_default_generals(root=DEFAULT_GENERALS):
    """Default's Generals keyed by id (file stem): the file's JSON plus its force (folder)."""
    default = {}
    for path in sorted(glob.glob(str(Path(root) / "*" / "*.json"))):
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        data["force"] = Path(path).parent.name
        default[Path(path).stem] = data
    return default


def zh_key(name_zh):
    return "".join(CJK.findall(name_zh or ""))


def name_keys(name):
    """The English-name keys to try, most specific first: letters only, "&" read as
    "and"; then again with a parenthetical such as "(Lady Gan)" removed."""
    def key(text):
        text = strip_diacritics(text.lower().replace("&", " and "))
        return re.sub(r"[^a-z]", "", text)
    plain = key(name)
    bare = key(re.sub(r"\([^)]*\)", " ", name))
    return [plain] if plain == bare else [plain, bare]


def match_default(parsed, default):
    """(default id, how) for a parsed General: "nameZh" when exactly one Default
    General has the same Chinese name, else "name" when exactly one has the same
    English name, else (None, None). Several candidates never match."""
    zh = zh_key(parsed.get("nameZh"))
    if zh:
        hits = [i for i, d in default.items() if zh_key(d.get("nameZh")) == zh]
        if len(hits) == 1:
            return hits[0], "nameZh"
    for key in name_keys(parsed["name"]):
        hits = [i for i, d in default.items() if key in name_keys(d["name"])]
        if len(hits) == 1:
            return hits[0], "name"
        if hits:
            break
    return None, None


def general_id(slug, default_id):
    """A matched General takes Default's id; otherwise the page slug, minus a
    trailing "-lady-xxx"."""
    return default_id or re.sub(r"-lady-[a-z]+$", "", slug)


# ------------------------------------------------------------------- records

FORCE_ANCHOR = {force: anchor for anchor, force in ANCHOR_FORCE.items()}


def build_record(entry, parsed, default, today):
    """One General's JSON record. HP and gender come only from a matched Default
    General (hpFrom says so); an unmatched General has neither."""
    default_id, _ = match_default(parsed, default)
    matched = default[default_id] if default_id else None
    rec = {"id": general_id(entry["slug"], default_id), "name": parsed["name"]}
    name_zh = parsed["nameZh"] or (matched or {}).get("nameZh")
    if name_zh:
        rec["nameZh"] = name_zh
    rec["force"] = entry["force"]
    if parsed["title"]:
        rec["title"] = parsed["title"]
    if matched:
        rec["maxHp"] = matched["maxHp"]
        rec["gender"] = matched["gender"]
        rec["hpFrom"] = "default"
    rec["skills"] = parsed["skills"]
    rec["synergisticPartners"] = parsed["synergisticPartners"]
    rec["differenceFromNormal"] = parsed["differenceFromNormal"]
    rec["source"] = {"url": entry["url"], "listedUnder": FORCE_ANCHOR[entry["force"]], "crawledAt": today}
    return rec


# ------------------------------------------------------------------ fetching

def fetch_page(url, cache, pause=1.0):
    """The page at url, from the cache folder when it is there, else downloaded
    (then cached, then a pause so the blog is not hammered)."""
    cached = Path(cache) / url.rstrip("/").rsplit("/", 1)[-1] if cache else None
    if cached and cached.exists():
        return cached.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (sanguosha-crawler)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # follows redirects
            if resp.status != 200:
                raise GeneralError(f"HTTP {resp.status}")
            text = resp.read().decode("utf-8", "replace")
    except (urllib.error.URLError, OSError) as err:
        raise GeneralError(f"could not fetch {url}: {err}") from err
    if cached:
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_text(text, encoding="utf-8")
    time.sleep(pause)
    return text


# -------------------------------------------------------------------- report

BLOCK_START = "<!-- generals:start -->"
BLOCK_END = "<!-- generals:end -->"


def normalise_text(text):
    """Cosmetic differences only: whitespace, curly vs straight quotes, dash kinds."""
    for a, b in (("\u201c", '"'), ("\u201d", '"'), ("\u2018", "'"), ("\u2019", "'"),
                 ("\u2013", "-"), ("\u2014", "-"), ("\u2011", "-")):
        text = text.replace(a, b)
    return " ".join(text.split())


def label(name, name_zh):
    return f"{name} ({name_zh})" if name_zh else name


def pair_skills(alt_skills, default_skills):
    """Skills matched by Chinese name when both have one, else by normalised English
    name: (pairs, only in Alternate, only in Default)."""
    left = list(default_skills)
    pairs, alt_only = [], []
    for a in alt_skills:
        hit = next((d for d in left if (a.get("nameZh") and a.get("nameZh") == d.get("nameZh"))
                    or normalise_text(a["name"]) == normalise_text(d["name"])), None)
        if hit:
            left.remove(hit)
            pairs.append((a, hit))
        else:
            alt_only.append(a)
    return pairs, alt_only, left


def skill_differences(rec, d):
    notes = []
    pairs, alt_only, default_only = pair_skills(rec["skills"], d.get("skills", []))
    for a, b in pairs:
        if normalise_text(a["name"]) != normalise_text(b["name"]):
            notes.append(f"{b['name']}: named {a['name']} in Alternate")
        if normalise_text(a["text"]) != normalise_text(b["text"]):
            notes.append(f"{a['name']}: text differs\n"
                         f"    - Alternate: {normalise_text(a['text'])}\n"
                         f"    - Default: {normalise_text(b['text'])}")
    if alt_only:
        notes.append("only in Alternate: " + ", ".join(a["name"] for a in alt_only))
    if default_only:
        notes.append("only in Default: " + ", ".join(b["name"] for b in default_only))
    return notes


def generals_report(records, matches, default, unparsed):
    """The marked Generals block of diff-vs-default.md: differences only, nothing resolved.
    matches maps a record id to match_default's (default id, how)."""
    only_alt = [r for r in records if not matches[r["id"]][0]]
    matched = {r["id"]: matches[r["id"]][0] for r in records if matches[r["id"]][0]}
    only_default = [(i, d) for i, d in default.items() if i not in set(matched.values())]
    forces = [(r, default[matched[r["id"]]]) for r in records
              if r["id"] in matched and r["force"] != default[matched[r["id"]]]["force"]]
    skills = [(r, notes) for r in records if r["id"] in matched
              for notes in [skill_differences(r, default[matched[r["id"]]])] if notes]
    fallback = [r for r in records if matches[r["id"]][1] == "name"]
    no_hp = [r for r in records if "hpFrom" not in r]

    lines = [BLOCK_START, "# Alternate Generals vs Default", "",
             "Generated by `scripts/crawl-alternate-generals.py`. It lists differences only; nothing is decided.",
             "Skill names and texts are compared after tidying whitespace, quotes and dashes.", ""]

    def section(title, rows, count=None):
        lines.extend([f"## {title} ({len(rows) if count is None else count})", ""] + (rows or ["- none"]) + [""])

    section("Only in Alternate", [f"- {label(r['name'], r.get('nameZh'))}, {r['force']}" for r in only_alt])
    section("Only in Default", [f"- {label(d['name'], d.get('nameZh'))}, {d['force']} [{i}]" for i, d in only_default])
    section("Force differs", [f"- {r['name']}: Alternate {r['force']}, Default {d['force']}" for r, d in forces])
    rows = []
    for r, notes in skills:
        rows.append(f"- **{label(r['name'], r.get('nameZh'))}**")
        rows += [f"  - {n}" for n in notes]
    section("Skills differ", rows, len(skills))
    rows = []
    for r in fallback:
        d = default[matches[r["id"]][0]]
        zh = f" (Chinese names: Alternate {r.get('nameZh')}, Default {d.get('nameZh')})" if r.get("nameZh") != d.get("nameZh") else ""
        rows.append(f"- {r['name']} -> {matches[r['id']][0]}{zh}")
    section("Matched by English name", rows)
    section("Missing HP and gender", [f"- {label(r['name'], r.get('nameZh'))}" for r in no_hp])
    section("Unparsed pages", [f"- {u['slug']} ({u['force']}): {u['reason']}" for u in unparsed])
    lines.append(BLOCK_END)
    return "\n".join(lines) + "\n"


def splice_report(existing, block):
    """existing with its marked Generals block replaced by block (or block added at the end)."""
    start, end = existing.find(BLOCK_START), existing.find(BLOCK_END)
    if start >= 0 and end > start:
        tail = existing[end + len(BLOCK_END):].lstrip("\n")
        return existing[:start] + block + (("\n" + tail) if tail else "")
    return (existing.rstrip("\n") + "\n\n" if existing.strip() else "") + block


# ---------------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", help="parse this saved copy of the index instead of fetching it")
    ap.add_argument("--pages", help="read the General pages (<slug>.html) from this folder instead of fetching them")
    ap.add_argument("--out", default=str(OUT_DIR), help="output folder")
    ap.add_argument("--no-cache", action="store_true", help="do not read or write the page cache")
    ap.add_argument("--pause", type=float, default=1.0, help="seconds to wait after each download")
    args = ap.parse_args(argv)

    cache = None if args.no_cache else CACHE_DIR
    try:
        index_html = Path(args.file).read_text(encoding="utf-8-sig") if args.file else fetch_page(URL, cache, args.pause)
        entries = parse_index(index_html)
    except GeneralError as err:
        print(f"PROBLEM: the index could not be read: {err}", file=sys.stderr)
        return 1

    default = load_default_generals()
    today = datetime.date.today().isoformat()
    records, unparsed, seen = [], [], set()
    for entry in entries:
        try:
            if args.pages:
                page = Path(args.pages) / f"{entry['slug']}.html"
                if not page.exists():
                    raise GeneralError(f"no saved page {page.name}")
                html = page.read_text(encoding="utf-8")
            else:
                html = fetch_page(entry["url"], cache, args.pause)
            parsed = parse_general(html)
            rec = build_record(entry, parsed, default, today)
            if rec["id"] in seen:
                raise GeneralError(f"id {rec['id']} is already used by another General")
        except GeneralError as err:
            unparsed.append({"slug": entry["slug"], "force": entry["force"], "reason": str(err)})
            continue
        seen.add(rec["id"])
        records.append((entry, parsed, rec))

    out = Path(args.out) / "generals"
    for old in glob.glob(str(out / "*" / "*.json")):
        Path(old).unlink()
    for _, _, rec in records:
        path = out / rec["force"] / f"{rec['id']}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    matches = {rec["id"]: match_default(parsed, default) for _, parsed, rec in records}
    block = generals_report([rec for _, _, rec in records], matches, default, unparsed)
    report_path = Path(args.out) / "diff-vs-default.md"
    existing = report_path.read_text(encoding="utf-8") if report_path.exists() else ""
    report_path.write_text(splice_report(existing, block), encoding="utf-8")

    print(f"{len(records)} Generals of {len(entries)} listed -> {out}")
    for u in unparsed:
        print(f"SKIPPED {u['slug']}: {u['reason']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
