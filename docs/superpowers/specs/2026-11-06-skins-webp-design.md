# Skins as WebP (first re-encoding stage)

The asset pipeline (`2026-11-06-assets-src-pipeline-design.md`) built the masters and the
build step with every recipe set to copy. This is the first stage that changes what ships:
the General skins, the largest group on the path every game uses.

Measured in the evaluation of 2026-11-05: the 66 skins are 10.09 MB of PNG (250 x 292, with
transparency), 1.10 MB as WebP at quality 85, with SSIM against the PNG of 0.984 on average
and 0.972 at worst. They are loaded for every seat and every General-selection screen, so
this is the largest single saving on the hot path.

## Goals

1. A new recipe op, `image`, converts a master image to another format. Its fields:
   `ext` (the output extension and format; only `webp` is supported), `quality` (default 85),
   `alphaQuality` (default 100, so soft edges stay exact). The output path is the master's
   path with its extension replaced, and the file is written with Pillow.
2. The `generals/skins` recipe becomes `{ "op": "image", "ext": "webp", "quality": 85 }`.
   The masters stay PNG in `assets-src/`; `assets/generals/skins/` ships WebP.
3. Nothing else changes: the skin URLs are built by `assetFile()` from the recipe, so they
   become `.webp` with no change to `skins.json` or the code. The specs that name skin URLs
   are updated.

## Non-goals

- No resizing (the skins are 250 x 292, already close to the largest size they are shown).
- No other folder. Cards, sprite sheets and audio are separate stages.
- No PNG fallback: every browser the app supports reads WebP.

## Anti-goals

- Transparency lost or a halo around a skin on a dark or light seat background.
- A skin that visibly differs from its master.
- A stale `.png` left in `assets/` (the build removes outputs no recipe produces) or a
  `.png` request that the app still makes.

## Calls made while writing (the author's)

1. **Quality 85, alpha quality 100, Pillow method 5** (the settings that were measured).
   Quality 90 costs about 0.3 MB more if 85 shows artefacts on a real screen.
2. The `image` op supports PNG and JPEG sources and the `webp` target only. Other formats
   are rejected by name, so a typo cannot ship a broken file.
3. The same stem with two source extensions in one folder is rejected, as for copies,
   because a reference without an extension could not tell them apart.

## Done when

1. Tests cover: planning an `image` recipe (output path, unsupported source or target
   extension, ambiguous stems), the conversion (format, size, transparency kept, quality
   changes size), and the build (a switch from copy to `image` replaces the old files and
   passes the check).
2. All 66 skins are WebP in `assets/`, the PNGs are gone from it, the lock and the check pass,
   and a fresh app build ships 66 `.webp` skins and no skin `.png`.
3. The sizes before and after, and the worst SSIM against the master, are measured on the real
   files and stated in the pull request, and the worst skin was looked at on dark and light
   backgrounds.
4. `npm run verify` and the whole test suite pass.
