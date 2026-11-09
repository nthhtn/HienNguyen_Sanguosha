# Playing cards and General cards as small WebP

Second re-encoding stage, after `2026-11-06-skins-webp-design.md`. The card art is shipped at
the size it was scanned (650 to 1000 px tall) but is never shown wider than 160 CSS px
(`app-card-art` large, `scene-card` and `scene-general` large). Measured on 2026-11-05: resizing
to 320 px wide (2x for sharp screens) and converting to WebP at quality 85 takes the cropped
cards from 3.93 MB to 0.86 MB (78% smaller, SSIM 0.97 against the resized card), and the full
cards (playing cards and General cards) from 19.5 MB to 4.4 MB. WebP alone, without the
resize, saves only 43% and 20%, because the sources are already JPEG.

## Goals

1. The `image` op gains `maxWidth`: a master wider than it is scaled down to that width,
   keeping its aspect ratio (Lanczos); a narrower one is never scaled up.
2. The `crop` op gains the same `maxWidth` and a `webp` output (`ext` is `jpg` or `webp`),
   applied after the cut, so a crop is cut from the full-size master and then shrunk once.
3. Recipes:
   - `playing-cards/full` and `generals/cards` become
     `{ "op": "image", "ext": "webp", "quality": 85, "maxWidth": 320 }`.
   - `playing-cards/cropped` becomes
     `{ "op": "crop", "from": "playing-cards/full", "ext": "webp", "quality": 85, "maxWidth": 320 }`.
4. Card URLs follow the recipes through `assetFile()`, so they become `.webp` with no change to
   `manifest.json` or the code. The specs that name card URLs, and the two tests that read the
   shipped card files with a JPEG parser, are updated: they read the masters and the crop
   boxes instead, which is where the full-size facts now live.

## Non-goals

- No other folder: the card back, backgrounds, UI art, sprite sheets and audio are separate.
- No 3x (480 px) variant. 320 px is sharp on 2x screens; a 3x phone sees slightly soft card
  art. Changing `maxWidth` to 480 is one recipe line if that matters (it keeps about 44% of
  the original size instead of 22%).
- No change to the crop boxes or the masters.

## Anti-goals

- A card cut at the wrong place, or text on a full card unreadable at 160 CSS px.
- A card scaled up, or its aspect ratio changed.
- A stale `.jpg` left in `assets/`, or a `.jpg` card request that the app still makes.

## Calls made while writing (the author's)

1. **`maxWidth` 320 for every card folder**, the size the evaluation measured; quality 85.
2. **Resize with Lanczos** (Pillow `Image.LANCZOS`), the filter the evaluation used.
3. **`maxWidth` must be a positive whole number** and **`crop` writes only `jpg` or `webp`**;
   anything else is rejected by name when the recipe is planned.
4. The full General cards (`generals/cards`) get the same treatment although they are only
   a fallback and a Wiki scene image: they are 12 MB of the repository's shipped weight.

## Done when

1. Tests cover: `maxWidth` on `image` and `crop` (scaled down with the aspect ratio kept, never
   scaled up, transparency kept), `crop` writing WebP, the recipe validation, and a build that
   applies each and rebuilds when `maxWidth` changes.
2. All card files in `assets/` are WebP at most 320 px wide, no card `.jpg` is left in
   them, the lock and the check pass, and a fresh app build ships the same number of images.
3. Sizes before and after, and the worst SSIM against the resized master, are measured on the
   real files and stated in the pull request, and the worst card was looked at.
4. `npm run verify` and the whole test suite pass.
