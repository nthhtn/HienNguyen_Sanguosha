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
