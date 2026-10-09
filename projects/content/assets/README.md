# Content assets (local-only)

Card-art images crawled by `scripts/crawl-assets.py` from the same source
site used by `projects/content/data/` (see
`docs/superpowers/specs/2026-09-24-content-asset-crawl-design.md`).

**These are scans of official commercial Sanguosha cards** (© 2008 Yoka
Games, illustration by KayaK), not original or freely-licensed art. They are
present here for local development/reference only:

- Do not push this directory's image files to a public remote.
- Do not redistribute them outside this local checkout.
- `manifest.json` (source URLs, crawl dates, dimensions) is safe to commit —
  it contains no image bytes. The images themselves are gitignored.

Run `scripts/crawl-assets.py` to (re-)populate this directory locally.
