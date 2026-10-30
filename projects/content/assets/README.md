# Content assets

Images and audio used by the content project. Most were originally crawled
from the same source site used by `projects/content/data/` (see
`docs/superpowers/specs/2026-09-24-content-asset-crawl-design.md`). They are
committed, and the crawler scripts have been removed from the repo (they remain
in git history), so a deployment never needs to crawl.

## Provenance and use

- Most images come from open-source references.
- Some are scans of official Sanguosha cards (© 2008 Yoka Games, illustration
  by KayaK). They are mostly not visible to users in the app anymore.
- This project is not used for any commercial purpose.
- If a rights holder asks for an asset to be removed, remove it or replace it
  with an open-source alternative.

`manifest.json` records source URLs, crawl dates and dimensions for each asset.

`preview/` holds the short skill preview videos, `<general-id>_<skill-id>_en.mp4`
and `<general-id>_<skill-id>_vi.mp4`. They are made for this project, not crawled, so they have
no manifest entry.
