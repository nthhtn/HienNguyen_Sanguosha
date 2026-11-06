# Content assets: the masters

This folder holds the **masters**: the original images and audio. Nobody ships from
here. `npm run assets:build` generates the files the game serves into `../assets/`,
which is committed but never edited by hand (`npm run assets:check` fails when it is
out of date, and CI runs it). A copy of this README is generated into `../assets/` too.
The design is in `docs/superpowers/specs/2026-11-06-assets-src-pipeline-design.md`.

Most images were originally crawled from the same source site used by
`projects/content/data/` (see `docs/superpowers/specs/2026-09-24-content-asset-crawl-design.md`).
They are committed, and the crawler scripts have been removed from the repo (they remain
in git history), so a deployment never needs to crawl.

## Provenance and use

- Most images come from open-source references.
- Some are scans of official Sanguosha cards (© 2008 Yoka Games, illustration
  by KayaK). They are mostly not visible to users in the app anymore.
- This project is not used for any commercial purpose.
- If a rights holder asks for an asset to be removed, remove it or replace it
  with an open-source alternative.

`manifest.json` records source URLs, crawl dates and dimensions for each asset. Its
`localPath` values, and the values in `generals/skins/skins.json`, carry no file
extension: `assets.ts` adds the one `../asset-recipes.json` ships for that folder.

`preview/` holds the short skill preview videos, `<general-id>_<skill-id>_en.mp4`
and `<general-id>_<skill-id>_vi.mp4`. They are made for this project, not crawled, so they
have no manifest entry, and the build never ships them.

## Layout

One folder per kind of thing, kebab-case names throughout (the rules are in
`docs/superpowers/specs/2026-11-06-assets-restructure-design.md`). The same paths appear
under `../assets/`, except where noted.

- `generals/` holds `skins/<force>/` (Play-screen portraits, mapped by `skins/skins.json`; the masters are PNG and ship as WebP, per `../asset-recipes.json`),
  `cards/<force>/` (full card art, shipped as WebP at most 320 px wide) and `special/` (face-down, placeholder and Ambitionist art).
- `playing-cards/full/<card-type>/` holds the full card art, plus `back.jpg` beside it. There is
  no `cropped/` here: the Play-screen art in `../assets/playing-cards/cropped/` is cut from the
  full-size cards by the boxes in `../asset-crops.json` (pixels of the master). Both ship as WebP at
  most 320 px wide, which is 2x the widest the app shows them (160 CSS px).
- `effects/` holds `stills/` and `frames/` (the frames of each sprite effect, never shipped).
  `../assets/effects/sheets/` is generated from the frames.
- `ui/` holds `banners/`, `hp/`, `chain/`, `battlefield/` and `brand/` (logo, landing page, favicon).
- `audio/` holds `music/`, `effects/`, `death/forces/`, `death/generals/<force>/` and `voice/{male,female}/`.

Images are served under `/images/` and audio under `/audio/`, mirroring the folders of `../assets/`.

## Working with the masters

Run everything from the repository root. `npm run assets:build` rewrites only the files
whose master or recipe changed, so it is quick; commit the masters, the changed files in
`assets/` and `assets/asset-lock.json` together.

**Add a General.** Put the full-size skin at `generals/skins/<force>/<pinyin>.png` and the
death voice at `audio/death/generals/<force>/<pinyin>.ogg`, add the skin to
`generals/skins/skins.json` (`"<general-id>": "<force>/<pinyin>"`) and a record to
`manifest.json`, then build. The `add-general` skill does these steps.

**Add a playing card.** Put the full art in `playing-cards/full/<card-type>/<id>.jpg`, add its
crop box `"<card-type>/<id>": [x, y, width, height]` (pixels of the full image) to
`../asset-crops.json`, add the manifest record, then build. The build stops if a full card
has no box, or a box has no full card.

**Replace a master.** Drop the new file over the old one and build. The recipes decide what
ships, so a larger or better original needs no other change.

**Change what ships.** Edit the folder's entry in `../asset-recipes.json` and build.
