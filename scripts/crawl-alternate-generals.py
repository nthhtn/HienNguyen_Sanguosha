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
import json
import re
import sys
import time
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
