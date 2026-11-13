# Asset masters and a build step (`assets-src/`)

## Intent

Keep the original art and audio as **masters** that nobody edits by accident, and make the
files the game ships (`projects/content/assets/`) a **generated** copy. This stage builds the
pipeline and proves it changes nothing. Later stages switch on resizing and re-encoding one
group at a time (skins to WebP, cards resized, audio to Opus), each with its own
before-and-after numbers, by editing one recipe line and rebuilding.

Why: lossy encoding loses detail each time it is applied, so shrinking the shipped files has to
start from an untouched original. Today the masters and the shipped files are the same files,
so there is nowhere to re-encode from and nothing that tells a master from a derivative.
The measurements behind the later stages are in the "Asset Weight Evaluation" artifact:
skins shrink 89%, cropped cards 78% with a resize, sprite sheets 64%, music 45%.

## Goals

1. `projects/content/assets-src/` holds the masters. It is committed, never shipped, and
   excluded from the Docker image.
2. `projects/content/assets/` becomes build output: committed, never edited by hand.
3. One command, `npm run assets:build`, makes everything in `assets/` from `assets-src/`. A
   second, `npm run assets:check`, fails when `assets/` is out of date. The check runs in
   `npm run verify` and CI, uses only Python's standard library, and needs no image or
   audio tools.
4. Settings (what is copied, cropped or packed, and later sizes, formats and quality) live in
   one file, `asset-recipes.json`, one entry per folder.
5. `playing-cards/cropped/` is cut from `playing-cards/full/` by recorded crop boxes
   (`asset-crops.json`), so it stops being a master.
6. References in data and code drop the file extension; the shipped extension for each group
   comes from the recipes, so a later format change touches one recipe line.
7. The `add-general` and `add-general-skill-preview` skills, the assets README and the
   architecture doc describe the new flow.

## Non-goals

- No resizing or re-encoding in this stage. Every recipe except the crop and the sprite packing
  says "copy", so shipped files stay byte-identical.
- No audio conversion, and no fix for the three `.ogg` files that hold MP3 data.
- No change to the URL scheme (`/images/`, `/audio/`) or to the folder layout under `assets/`.
- No removal of the duplicate copy of `assets/` in the Docker runtime image. Only the
  `.dockerignore` line that keeps `assets-src/` out is in scope.
- No rename of `manifest.json`, and no filling of its provenance gaps (nine General cards).
- No helper that proposes a crop box for a new card (a later nicety).

## Anti-goals (a failure even if it technically works)

- Shipped files change bytes or look different (other than the regenerated crops, below).
- CI needs `ffmpeg`, Pillow or any encoder just to run the check.
- A hand edit to a file in `assets/` goes unnoticed.
- A master ends up in the shipped build or the Docker image.
- Adding a General becomes harder than it is today.

## Layout

```
projects/content/
  assets-src/                      masters; same sub-layout as assets/, except where noted
    generals/{skins,cards,special}/...
    playing-cards/full/<card-type>/...,  playing-cards/back.jpg
    effects/stills/...,  effects/frames/<effect>/<n>.png
    ui/...
    audio/...
    manifest.json                  hand-maintained provenance (moved from assets/)
    generals/skins/skins.json      hand-maintained id-to-skin map (moved from assets/)
    preview/                       skill preview videos and index.json (copied by the build; see the note below)
  asset-recipes.json               one entry per folder
  asset-crops.json                 crop box per playing card
  assets/                          GENERATED. what ships. includes asset-lock.json
    (same paths as today)
```

`assets/` keeps exactly the paths it has today, so `angular.json`, the URLs and the existing
tests keep working. The only differences: `playing-cards/cropped/` is generated;
`effects/sheets/` (including `sheets.json`) is generated from `effects/frames/`;
`manifest.json` and `skins.json` are copied from `assets-src/` unchanged; and
`effects/frames/` no longer exists under `assets/`, so the `"ignore": ["effects/frames/**"]`
rule in `angular.json` goes away.

## The build

`scripts/build-assets.py`, run from the repo root (Python 3 and Pillow, which the sprite script
already uses). It reads `asset-recipes.json` and writes `assets/`:

- **copy:** the file is copied byte for byte.
- **crop:** `playing-cards/cropped/<type>/<id>.jpg` is cut from `playing-cards/full/<type>/<id>.jpg`
  using the box (x, y, width, height, in pixels of the full image) recorded for that id in
  `asset-crops.json`, and saved as JPEG. The 49 boxes are recovered once from the current files by
  matching each crop inside its full card (all 49 match at the same scale, with only JPEG noise as
  the difference). The JPEG quality (92) is the one that matches today's files best: each
  regenerated crop differs from today's file by at most 5 brightness levels on average.
- **sprite sheets:** `effects/sheets/<id>.png` and `sheets.json` are built from `effects/frames/`
  by the logic now in `scripts/build-sprite-sheets.py`, which folds into the same command.
- The build is idempotent: running it twice leaves no diff. It removes files in `assets/` that no
  recipe produces.

## The check

`assets/asset-lock.json` lists every file the build produced: its path, the master it came from,
the hash of that master, a hash of the recipe that applies to it, and the hash of the output.
`npm run assets:check` recomputes the hashes of the masters, recipes and shipped files and fails
when any of these holds:

- A master or its recipe changed since the lock was written (the derivative is stale);
- A shipped file's hash differs from the lock (someone edited `assets/` by hand);
- A recipe produces a file that is missing, or `assets/` holds a file the lock does not know.

The failure message names the file and says to run `npm run assets:build`.

## References without extensions

`manifest.json` `localPath` values, `skins.json` values, and the paths code builds
(`assets.ts`) stop carrying the file extension. `assets.ts` adds the shipped extension for the
group the path belongs to, read from `asset-recipes.json` (one source of truth, not a second
table in code). Death voices follow the same rule. The URLs the app requests do not change in
this stage, so every existing URL test keeps passing.

## Docker

`.dockerignore` gains `projects/content/assets-src`, so the build and runtime images do not grow
by the size of the masters (about 54 MB).

## Workflows

**Add a General.** Put the full-size skin at `assets-src/generals/skins/<force>/<pinyin>.png` and
the death voice at `assets-src/audio/death/generals/<force>/<pinyin>.ogg`, add the skin entry and
the manifest record (both without extensions), run `npm run assets:build`, and commit the masters,
the generated files and the lock together. With no image or voice, add none of these, as today.

**Add a playing card.** Put the full art in `assets-src/playing-cards/full/<card-type>/`, record
its crop box in `asset-crops.json`, add the manifest record, and build.

**Replace a master** (for example with a larger original, when one turns up): drop the new file
over the old one and rebuild. The recipes decide what ships.

## Done when

1. Every path under `assets/` matches today's, and every file hashes the same as today's except
   the 49 regenerated crops, which each differ from the current file by at most 5 brightness levels on
   average and look identical side by side. (A stricter match is impossible: today's crops are separately
   encoded JPEGs, so even a lossless cut of the master scores only 0.945 to 0.99 SSIM against them.)
2. `npm run assets:check` passes on the result, and fails (with a message naming the file) after
   each of: editing a master, editing a shipped file by hand, deleting a shipped file, adding a
   stray file to `assets/`.
3. Running `npm run assets:build` twice leaves no diff.
4. `npm run verify` and all tests pass, and a fresh Angular build ships the same files as before.
5. The Docker build context excludes `assets-src/`.
6. The two skills, the README and the architecture doc describe the new flow, and a dry read of
   the `add-general` steps produces files that pass the check.

## Generated files are committed, not built at deploy

`assets/` is built on the developer's machine and committed with the masters; the Docker build
and Render only use what is committed, and CI only runs `assets:check` (a hash comparison).
Reasons: deploys stay fast and need no image or audio tools (Render's free tier), the exact
bytes that ship are visible in the pull request, and a tool upgrade can never change shipped
art silently. The cost is that the repository holds masters and derivatives (about 13 MB of
derivatives once the later stages land), and a forgotten rebuild is caught by the check.
Generating at deploy was considered and rejected: it adds ffmpeg and Pillow to the image,
slows every build, and hides the shipped output from review.

## Calls made while writing (the author's, not yet confirmed by the developer)

1. **Extensions.** Each entry in `asset-recipes.json` is keyed by a folder path and names its
   shipped extension explicitly (`"ext": "png"`); nothing is inferred from the master. A path
   uses the entry with the longest matching folder prefix, so `effects/stills` and
   `effects/frames` can differ and `audio/death/generals/<force>` falls under `audio/death`. The
   `.ogg` files that hold MP3 data keep `"ext": "ogg"`, as today.
2. **Who reads the recipes.** `assets.ts` imports `asset-recipes.json` at build time, the way it
   already imports `manifest.json`, so the small file ships in the bundle and no generated map
   is needed. Only `assets.ts` and the build script read it. The recipes live in
   `projects/content/`, outside `assets/`, and the lock records the recipes' hash, so the check
   covers them.
3. **The check never re-runs the build.** `assets:check` only compares hashes against the lock.
   The build is **incremental by input hash**: an output is rewritten only when its master or its
   recipe changed since the lock, so another machine's Pillow or zlib never rewrites unchanged
   files and never produces a noisy diff. Output bytes need not reproduce across machines.
4. **Crop quality.** One JPEG quality (92) is used for all crops. The comparison with today's
   files (mean absolute difference per card, plus a side-by-side look at the worst) is a one-off
   verification while building this stage, not a committed test.
5. **Sprite sheets.** Rebuilding them from `effects/frames/` with the current script already
   reproduces today's files byte for byte on the developer's machine (checked on 2026-11-06),
   so the "same hash" criterion holds for them.
6. **Moving the masters.** Masters move with `git mv` (history follows), and the build then
   recreates `assets/`. `playing-cards/cropped/` is not moved: the build produces it from
   `playing-cards/full/`. `effects/frames/` moves to `assets-src/` only.
7. **Docker.** The build stage copies the context with `COPY . .`, which honours
   `.dockerignore`, and the runtime stage copies only from the build stage, so one
   `.dockerignore` line keeps the masters out of both. `angular.json` globs name
   `projects/content/assets`, so they cannot reach `assets-src/`. The lock lists every file in
   `assets/`, including the copied `manifest.json` and `skins.json`, as copies from
   `assets-src/`. (Amended 2026-11-09: the Wiki plays the preview videos, so they do ship. The masters live in
   `assets-src/preview/<force>/` with `index.json`, the build copies `index.json`, and the videos are
   re-encoded to the size the Wiki shows, by the `video` recipe in `2026-11-09-preview-video-design.md`. They
   are no longer ignored.)
8. **Skills and the dry read.** The skills are developer instructions, not UI text, so the UI
   text rules do not apply to them. The dry read is a manual step while building this stage:
   add a temporary master pair following the new `add-general` steps, build, run the check,
   then revert.

## Left to the builder

The structure of `build-assets.py`, the exact schema of the two recipe files and the lock, the
JPEG settings that meet the SSIM bar, how `assets.ts` finds the longest matching folder entry,
and the names of any helper functions.
