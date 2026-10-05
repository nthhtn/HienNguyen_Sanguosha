# Sanguosha Content Asset Crawl — Design Spec

Status: Approved for implementation planning
Date: 2026-09-24

## Purpose

Give `projects/content` a local source of visual card-art assets (general
portraits, card face art) for the base-set generals and cards, sourced from
the same site already used for text identity data (see
`docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md`). This is
purely a crawl-and-store milestone: it produces image files and a manifest on
disk. It does not wire images into the registry, the engine, or any UI —
there is no Angular presentation layer yet (per CLAUDE.md, that is a future
sub-project), so there is no consumer to integrate with today.

## Key finding from the pre-design spike

Before designing storage/process, a spike against four sample pages (one
general, one weapon, one horse, one tool card) confirmed two things that
shape this design:

1. **"General portrait" and "card face art" are the same asset.** Each
   source page embeds exactly one full scan of the physical printed card
   (Chinese card face, card number, e.g. "WEI 001") — not a separate
   character illustration. There is one image to crawl per item, not two.
2. **The image is copyrighted commercial card art**, not free/fan content:
   the sampled scan carries a visible "TM & © 2008 游卡桌游 (Yoka Games),
   Illustration KayaK" notice. This is materially different from the text
   data (names/HP/rules text are facts, not copyrightable) crawled in the
   prior milestone. Decision (confirmed with the human partner): crawl
   anyway, but keep the actual image bytes **local-only** — never committed
   to git, never pushed to a public remote. The repo currently has no
   LICENSE file and no configured git remote, so this is a live constraint
   to design around now, not a future cleanup.

## Scope of this milestone

In scope:
- One image file per already-crawled base-set general/card (25 generals +
  21 cards = 46 items), fetched from the same `source.url` already recorded
  in `projects/content/data/**/*.json` by the prior text-crawl milestone.
- A committed manifest (`projects/content/assets/manifest.json`) recording,
  per id: local path, source page URL, crawled-at date, image dimensions.
- A reusable crawl script (`scripts/crawl-assets.py`) — unlike the prior
  milestone's throwaway scripts, this one is meant to be re-run for future
  expansion-pack crawls, since the extraction pattern is mechanical rather
  than judgment-based (see "Why this can be automated" below).
- `.gitignore` rules keeping the actual image bytes out of git while keeping
  the manifest and script tracked.

Explicitly out of scope (deferred):
- Kingdom/faction icons (Wei/Shu/Wu/Qun badges). No dedicated source for
  standalone icons was found on the site during the spike; this is a much
  smaller follow-up (4 icons) to revisit separately, likely hand-sourced
  rather than crawled.
- Any registry, engine, or UI integration of these images — there is no
  Angular presentation layer yet to consume them.
- Any general/card beyond the base set (same boundary as the text-data
  milestone).
- Re-deriving or upscaling images beyond what the source page serves.
- A public-distribution licensing resolution (e.g. commissioning original
  art, or seeking a redistribution license) — this milestone only needs to
  keep the repo safe *as it exists today* (local-only, no remote). If the
  repo later gains a public remote, this must be revisited before that
  happens, not after.

## Why this can be automated (unlike the text crawl)

The prior text-crawl milestone required heavy supervision because a naive
LLM fetch-and-summarize pass was observed to **fabricate** plausible-looking
field values. Image identification does not carry that risk in the same
way: the spike found a single, consistent, mechanical marker across every
page template sampled (general, weapon, horse, tool) — the content image
is the only `<img>` tag with `class="CENy8b"`; every other `<img>` on the
page is a duplicate copy of the site's own banner logo. This is a structural
HTML property to check for, not a judgment call about what a page "means,"
so a script can apply it directly without a fabrication-risk supervision
loop. The residual risk (a page that doesn't follow this template) is
handled by failing loudly rather than guessing — see below.

## Storage & manifest

```
projects/content/assets/
  generals/
    wei/cao-cao.jpg, sima-yi.jpg, ...       (same subfolder layout as data/generals/)
    shu/..., wu/..., qun/...
  cards/
    basic/sha.jpg, ...                       (same subfolder layout as data/cards/)
    tool/duel.jpg, ...
    equipment/weapon/crossbow.jpg, ...
    equipment/armor/eight-trigrams.jpg
    equipment/horse/di-lu.jpg, ...
  manifest.json
  README.md
```

Each image file is named `<id>.jpg` (or whatever extension the source
serves), placed at the same relative path as that id's JSON file under
`data/`, so the two trees mirror each other 1:1 and an id can be located in
either without a lookup table.

`manifest.json` shape:

```ts
interface AssetManifestEntry {
  localPath: string;   // e.g. "generals/wei/cao-cao.jpg", relative to assets/
  sourceUrl: string;   // the page URL the image was found on (same as data file's source.url)
  crawledAt: string;   // e.g. "2026-09-24"
  width: number;
  height: number;
}
// projects/content/assets/manifest.json
type AssetManifest = Record<string, AssetManifestEntry>; // keyed by id, same ids as data/
```

`manifest.json` and `README.md` are committed to git. The image files
themselves are not — see Git handling below. `README.md` states plainly:
these are scans of official commercial Sanguosha cards (Yoka Games, 2008),
present for local development/reference only, not licensed for
redistribution, and must not be pushed to a public remote.

This is a deliberately separate tree from `projects/content/data/`, not a
new field inside the existing per-item JSON files: the data files are
core, always-present, committed content; the asset images are optional,
local-only, and regenerable by re-running the crawl script — different
lifecycles justify different locations, per this file's own "domain
concepts should have clear responsibilities" principle.

## Git handling

Add to `.gitignore`:

```
projects/content/assets/**/*.jpg
projects/content/assets/**/*.jpeg
projects/content/assets/**/*.png
projects/content/assets/**/*.webp
```

This keeps `manifest.json` and `README.md` tracked (they don't match the
image-extension patterns) while every downloaded image stays untracked,
regardless of which subfolder it lands in. A fresh clone has the manifest
(so it knows what *should* exist) but not the images themselves until
someone runs the crawl script locally.

## Crawl script (`scripts/crawl-assets.py`)

Process, per id found in `projects/content/data/**/*.json`:

1. Read the file's `source.url`.
2. Fetch the page HTML (plain HTTP GET with a browser-like User-Agent —
   confirmed during the spike that the actual card image is present in the
   static HTML response; no JS rendering/headless browser needed).
3. Find all `<img>` tags; select the one(s) with `class="CENy8b"`.
   - **Exactly one match:** proceed.
   - **Zero or more than one match:** skip this id, print a warning
     (`Skipping <id>: expected exactly one content image, found N`), and
     continue to the next id. Never guess which image is "probably" right.
4. Download the matched image's `src` URL to
   `projects/content/assets/<same-relative-path-as-data>/<id>.<ext>`.
5. Record/update the entry in `manifest.json` (path, source URL, crawl
   date, dimensions read back from the downloaded file).

Idempotency: if `<id>` already has a manifest entry, skip re-downloading it
unless run with `--force`. Supports a `--only <id>` flag for re-crawling a
single item during troubleshooting.

This script is checked in as a genuine reusable tool (unlike the prior
milestone's two throwaway transcription scripts) because the same
mechanical process is expected to repeat unchanged for future
expansion-pack crawls.

## Verification / testing strategy

This is a Python utility outside the TypeScript project's Jest suite (same
as the prior milestone's two scripts) — there is no automated test suite
for it. Verification is:

- The script's own loud-skip behavior (step 3 above) is the primary
  correctness safeguard — it refuses to store an unidentified image rather
  than silently storing a wrong one.
- After running the full crawl, manually open a spot-check sample spanning
  every category (at least one general, one basic card, one tool card, one
  weapon, one horse, one armor) and visually confirm each downloaded image
  matches its id before treating the batch as good.
- Confirm `git status` shows only `manifest.json`/`README.md` as trackable
  changes under `projects/content/assets/`, never the image files
  themselves, before committing.

## Open items requiring a decision

None block landing this crawl script itself:

1. **Kingdom/faction icon source** — deferred, no source found yet (see
   Scope above).
2. **Public-distribution licensing** — deferred until/unless this repo
   gains a public remote (see "Why this can be automated" / Scope above);
   the local-only-and-gitignored approach here is sufficient for the
   current local-only repo state but is not a permanent resolution.
