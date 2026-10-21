#!/usr/bin/env python3
"""Crawl the Alternate deck's card data (Kingdom War base set) from the LTK
general list page. See docs/superpowers/specs/2026-10-20-alternate-deck-crawl-design.md.

Reads the page's card table (#cardtable), keeps only the printings of one
edition (default: 国战, the Kingdom War base set, 108 cards), and writes into
projects/content/data/decks/alternate/:

  deck.json          what the engine reads: each card's id and its printings
  ids.json           (hand-kept, not written) ids for cards Default does not have
  cards.json         identity, category, printings, range/mount, Default match
  texts.zh.json      the printed effect text, by Chinese name
  diff-vs-default.md what differs from the Default deck (listed, not resolved)

Nothing in the game reads these files yet, and Default's data is never edited.

Never guesses: a card whose row cannot be parsed is reported and skipped, and
the script exits non-zero if anything was skipped or the printing total is not
what the page states (108).

Usage:
  scripts/crawl-alternate-deck.py                 # fetch the live page
  scripts/crawl-alternate-deck.py --file page.html   # parse a saved copy (no network)
  scripts/crawl-alternate-deck.py --edition junzheng # another edition, by the page's CSS class
"""
import argparse
import collections
import datetime
import glob
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL = "https://zhangshenxing.github.io/LTKGeneralList"
SITE = "LTK general list (zhangshenxing)"
PAGE_UPDATED = "2020/10/21"
EXPECTED_TOTAL = {"guozhan": 108}

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CARDS = ROOT / "projects/content/data/cards"
OUT_DIR = ROOT / "projects/content/data/decks/alternate"

SUITS = {"黑桃": "spade", "梅花": "club", "红桃": "heart", "方块": "diamond"}
RANKS = {"A": 1, "J": 11, "Q": 12, "K": 13}
SUIT_START = re.compile(r"^(黑桃|梅花|红桃|方块)")
CATEGORIES = {"基本牌": "basic", "锦囊牌": "tool", "装备牌": "equipment"}
# Default's Slash, Dodge and Peach have no nameZh in its data; Default's own
# files are not edited, so the match for these three is kept here.
DEFAULT_ID_FOR_ZH = {"杀": "sha", "闪": "shan", "桃": "peach"}


# ---------------------------------------------------------------- HTML grid

class Cell:
    def __init__(self, tag, attrs):
        a = dict(attrs)
        self.tag = tag
        self.cls = a.get("class") or ""
        self.rowspan = int(a.get("rowspan") or 1)
        self.colspan = int(a.get("colspan") or 1)
        self.parts = []

    @property
    def lines(self):
        text = "".join(self.parts)
        out = []
        for line in text.split("\n"):
            line = re.sub(r"\s+", "", line)  # CJK text: whitespace is never meaningful
            if line:
                out.append(line)
        return out


class TableParser(HTMLParser):
    """Collects the rows of <table id="cardtable">. The page leaves <td>/<th>/<tr>
    open in places, so implied end tags are handled here."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_table = False
        self.rows = []
        self.cell = None

    def _close_cell(self):
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            if dict(attrs).get("id") == "cardtable":
                self.in_table = True
            return
        if not self.in_table:
            return
        if tag == "tr":
            self._close_cell()
            self.rows.append([])
        elif tag in ("td", "th"):
            self._close_cell()
            if not self.rows:
                self.rows.append([])
            self.cell = Cell(tag, attrs)
            self.rows[-1].append(self.cell)
        elif tag == "br" and self.cell is not None:
            self.cell.parts.append("\n")

    def handle_endtag(self, tag):
        if not self.in_table:
            return
        if tag == "table":
            self.in_table = False
        elif tag in ("td", "th"):
            self._close_cell()
        elif tag == "tr":
            self._close_cell()

    def handle_data(self, data):
        if self.in_table and self.cell is not None:
            self.cell.parts.append(data)


def expand_grid(rows):
    """Browser-style table layout: each logical row becomes a list of cells by
    column, with rowspan/colspan cells repeated (the same Cell object) in every
    slot they cover."""
    pending = {}  # column -> (cell, rows still to cover)
    grid = []
    for row in rows:
        out = []
        col = 0
        cells = list(row)
        while cells or any(c >= col for c in pending):
            if col in pending:
                cell, left = pending[col]
                out.append(cell)
                if left <= 1:
                    del pending[col]
                else:
                    pending[col] = (cell, left - 1)
                col += 1
                continue
            if not cells:
                break
            cell = cells.pop(0)
            for i in range(cell.colspan):
                out.append(cell)
                if cell.rowspan > 1:
                    pending[col + i] = (cell, cell.rowspan - 1)
            col += cell.colspan
        grid.append(out)
    return grid


# ------------------------------------------------------------------ parsing

class CardError(Exception):
    pass


def parse_distribution(text):
    """`黑桃5/7/8，梅花2/J，红桃10` -> [(suit, rank), ...]; a repeated rank is a copy."""
    printings = []
    for group in re.split(r"[，,、]", text):
        m = re.match(r"^(黑桃|梅花|红桃|方块)(.+)$", group)
        if not m:
            raise CardError(f"cannot read a suit in {group!r}")
        for token in m.group(2).split("/"):
            if token in RANKS:
                rank = RANKS[token]
            elif re.fullmatch(r"\d+", token) and 1 <= int(token) <= 13:
                rank = int(token)
            else:
                raise CardError(f"cannot read the rank {token!r} in {group!r}")
            printings.append({"rank": rank, "suit": SUITS[m.group(1)]})
    return printings


def classify_equipment(detail):
    """(subtype, extra fields) from the lines of an equipment card."""
    for line in detail:
        m = re.match(r"^攻击范围[:：](\d+)", line)
        if m:
            return "weapon", {"range": int(m.group(1))}
        if line == "防具":
            return "armor", {}
        if line == "+1坐骑":
            return "mount", {"mount": "defensive"}
        if line == "-1坐骑":
            return "mount", {"mount": "offensive"}
    raise CardError("cannot tell what kind of equipment this is")


def parse_cards(html, edition):
    """-> (cards, skipped). cards: [{nameZh, category, subtype?, printings, text, ...}]."""
    parser = TableParser()
    parser.feed(html)
    grid = expand_grid(parser.rows)

    cards, skipped = [], []
    category = None
    order = []  # card names in page order
    by_name = collections.OrderedDict()  # name -> {"editions": {cls: dist Cell}, "notes": [text lines]}

    for row in grid:
        if not row:
            continue
        if len(row) == 3 and row[0] is row[1] is row[2] and row[0].tag == "th":
            category = CATEGORIES.get("".join(row[0].lines))
            continue
        if len(row) < 3 or row[0].tag != "th":
            continue
        name = "".join(row[0].lines)
        entry = by_name.setdefault((category, name), {"editions": {}, "notes": []})
        if row[1] is row[2]:  # full-width effect row
            entry["notes"].append(row[1])
        elif row[2].tag == "th":
            entry["editions"].setdefault(row[2].cls, []).append(row[1])

    for (category, name), entry in by_name.items():
        rows_of_edition = entry["editions"].get(edition)
        if not rows_of_edition:
            continue
        try:
            if category is None:
                raise CardError("row is outside a Basic/Tool/Equipment section")
            # An edition can have several rows: the one with the suits and ranks,
            # and others whose cell is the printed effect text.
            dists = [c for c in dict.fromkeys(rows_of_edition) if c.lines and SUIT_START.match(c.lines[0])]
            texts = [c for c in dict.fromkeys(rows_of_edition) if c not in dists]
            if len(dists) != 1:
                raise CardError(f"expected one distribution row, found {len(dists)}")
            lines = dists[0].lines
            printings = parse_distribution(lines[0])
            if not printings:
                raise CardError("no printings")
            detail = lines[1:]
            for cell in texts + entry["notes"]:
                detail += cell.lines
            card = {"nameZh": name, "category": category, "printings": printings}
            if category == "equipment":
                subtype, extra = classify_equipment(detail)
                card["subtype"] = subtype
                card.update(extra)
            card["text"] = "\n".join(detail) or None  # the page prints none for Slash
            cards.append(card)
        except CardError as err:
            skipped.append({"nameZh": name, "reason": str(err)})
    return cards, skipped


# ---------------------------------------------------------- Default matching

def load_default():
    """Default cards keyed by their id (file stem). Only the printings the game
    deals count: ones tagged with an expansion stay out, as in the engine."""
    default = {}
    for path in sorted(glob.glob(str(DEFAULT_CARDS / "**/*.json"), recursive=True)):
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        card_id = Path(path).stem
        dealt = [p for p in data.get("printings", []) if not p.get("expansion")]
        default[card_id] = {
            "name": data.get("name"),
            "nameZh": data.get("nameZh"),
            "printings": dealt,
            "range": data.get("range"),
            "mount": data.get("mount"),
        }
    return default


def default_id_for(name_zh, default):
    if name_zh in DEFAULT_ID_FOR_ZH:
        return DEFAULT_ID_FOR_ZH[name_zh]
    matches = [i for i, d in default.items() if d["nameZh"] == name_zh]
    if len(matches) > 1:
        raise CardError(f"{name_zh} matches several Default cards: {matches}")
    return matches[0] if matches else None


def deck_entries(cards, ids):
    """The deck's entries, in page order: each card's engine id (Default's id when it
    has the card, else the hand-kept ids.json entry) and its printings."""
    entries = []
    for c in cards:
        card_id = c["defaultCardId"] or (ids.get(c["nameZh"]) or {}).get("id")
        if not card_id:
            raise CardError(f"{c['nameZh']} has no card id: Default lacks it and ids.json has no entry")
        entries.append({"cardId": card_id, "printings": c["printings"]})
    return entries


def tally(printings):
    return collections.Counter((p["suit"], p["rank"]) for p in printings)


def fmt_tally(counter):
    suit_order = ["spade", "heart", "club", "diamond"]
    sym = {"spade": "♠", "heart": "♥", "club": "♣", "diamond": "♦"}
    names = {1: "A", 11: "J", 12: "Q", 13: "K"}
    items = sorted(counter.items(), key=lambda kv: (suit_order.index(kv[0][0]), kv[0][1]))
    return " ".join(f"{sym[s]}{names.get(r, r)}" + (f"×{n}" if n > 1 else "") for (s, r), n in items)


def plural(n):
    return f"{n} card" + ("" if n == 1 else "s")


def diff_report(cards, default):
    matched_ids = {c["defaultCardId"] for c in cards if c["defaultCardId"]}
    only_alt = [c for c in cards if not c["defaultCardId"]]
    only_default = [
        (i, d) for i, d in default.items()
        if i not in matched_ids and d["printings"]
    ]
    changed = []
    for c in cards:
        i = c["defaultCardId"]
        if not i:
            continue
        d = default[i]
        notes = []
        a, b = tally(c["printings"]), tally(d["printings"])
        if a != b:
            notes.append(
                f"copies/suits/ranks: Alternate {sum(a.values())} ({fmt_tally(a)}), Default {sum(b.values())} ({fmt_tally(b)})"
            )
        if c.get("range") != d["range"] and (c.get("range") or d["range"]):
            notes.append(f"range: Alternate {c.get('range')}, Default {d['range']}")
        if c.get("mount") != d["mount"] and (c.get("mount") or d["mount"]):
            notes.append(f"mount: Alternate {c.get('mount')}, Default {d['mount']}")
        if notes:
            changed.append((c, d, notes))

    lines = ["# Alternate vs Default", "",
             "Generated by `scripts/crawl-alternate-deck.py`. It lists differences only; nothing is decided.",
             "Effect text is not compared yet (Default's is English, Alternate's is Chinese).", ""]
    lines += [f"## Only in Alternate ({len(only_alt)})", ""]
    lines += [f"- {c['nameZh']} ({c['category']}), {plural(c['count'])}" for c in only_alt] or ["- none"]
    lines += ["", f"## Only in Default ({len(only_default)})", ""]
    lines += [f"- {d['name']} ({d['nameZh'] or i}), {plural(len(d['printings']))}" for i, d in only_default] or ["- none"]
    lines += ["", f"## Different copies, suits, ranks, range or mount ({len(changed)})", ""]
    for c, d, notes in changed:
        lines.append(f"- **{c['nameZh']}** / {d['name']}")
        lines += [f"  - {n}" for n in notes]
    if not changed:
        lines.append("- none")
    same = len(cards) - len(only_alt) - len(changed)
    lines += ["", f"## Identical ({same})", ""]
    return "\n".join(lines) + "\n"


GENERALS_BLOCK = re.compile(r"<!-- generals:start -->.*?<!-- generals:end -->\n?", re.S)


def keep_generals_block(report, existing):
    """The card report, followed by the Generals block that crawl-alternate-generals.py
    put in the existing file (if any), so rewriting the cards never drops it."""
    block = GENERALS_BLOCK.search(existing)
    return report.rstrip("\n") + "\n\n" + block.group(0) if block else report


# ---------------------------------------------------------------------- main

def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # follows the 301
        return resp.read().decode("utf-8-sig")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", help="parse this saved copy of the page instead of fetching it")
    ap.add_argument("--edition", default="guozhan", help="the page's CSS class for the edition (default: guozhan, 国战)")
    ap.add_argument("--out", default=str(OUT_DIR), help="output folder")
    args = ap.parse_args(argv)

    html = Path(args.file).read_text(encoding="utf-8-sig") if args.file else fetch()
    cards, skipped = parse_cards(html, args.edition)

    default = load_default()
    problems = []
    for c in cards:
        try:
            c["defaultCardId"] = default_id_for(c["nameZh"], default)
        except CardError as err:
            skipped.append({"nameZh": c["nameZh"], "reason": str(err)})
            c["defaultCardId"] = None
        c["count"] = len(c["printings"])

    ids_path = Path(args.out) / "ids.json"
    ids = json.loads(ids_path.read_text(encoding="utf-8")) if ids_path.exists() else {}
    for c in cards:
        c["cardId"] = c["defaultCardId"] or (ids.get(c["nameZh"]) or {}).get("id")
    unmapped = [c for c in cards if not c["cardId"]]
    for c in unmapped:
        skipped.append({"nameZh": c["nameZh"], "reason": "no card id: Default lacks it and ids.json has no entry"})
    cards = [c for c in cards if c["cardId"]]

    total = sum(c["count"] for c in cards)
    expected = EXPECTED_TOTAL.get(args.edition)
    if expected is not None and total != expected:
        problems.append(f"printing total is {total}, the page states {expected}")
    if skipped:
        problems.append(f"{len(skipped)} card(s) skipped")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()
    cards_out = [
        {k: c[k] for k in ("nameZh", "category", "subtype", "count", "cardId", "defaultCardId", "range", "mount", "printings") if k in c}
        for c in cards
    ]
    (out / "cards.json").write_text(json.dumps({
        "deck": "alternate",
        "edition": args.edition,
        "source": {"url": URL, "site": SITE, "pageUpdated": PAGE_UPDATED, "crawledAt": today},
        "total": total,
        "cards": cards_out,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "deck.json").write_text(json.dumps({
        "id": "alternate",
        "entries": deck_entries(cards, ids),
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "texts.zh.json").write_text(
        json.dumps({c["nameZh"]: c["text"] for c in cards if c["text"]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report_path = out / "diff-vs-default.md"
    existing = report_path.read_text(encoding="utf-8") if report_path.exists() else ""
    report_path.write_text(keep_generals_block(diff_report(cards, default), existing), encoding="utf-8")

    by_cat = collections.Counter(c["category"] for c in cards)
    print(f"{len(cards)} cards, {total} printings ({dict(by_cat)}) -> {out}")
    for c in cards:
        if not c["text"]:
            print(f"note: the page prints no effect text for {c['nameZh']}")
    for s in skipped:
        print(f"SKIPPED {s['nameZh']}: {s['reason']}", file=sys.stderr)
    for p in problems:
        print(f"PROBLEM: {p}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
