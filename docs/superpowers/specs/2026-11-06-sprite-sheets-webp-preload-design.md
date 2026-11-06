# Sprite sheets as lossy WebP, and preloaded

Third re-encoding stage (after skins and cards), plus the one behaviour change the evaluation of
2026-11-05 asked for. A seat effect (a Slash hit, the chain, damage) is a CSS background set at the
moment of the event, and nothing fetches the sheet earlier. Measured in Chromium against the real
animation code: on 4G the slash sheet was ready 451 ms after the hit started (the visible hit burst is
about 0.12 to 0.8 s in); on a slow connection (1.6 Mbps) the PNG was not ready within the whole 2 s
animation, and lossy WebP took 1.15 s, which also misses the burst. A smaller sheet helps, but only
fetching the sheets before the first hit makes the first hit reliable.

## Goals

1. The `sheets` recipe can write WebP: `ext` (`png`, the default, or `webp`) and `quality` (default 85,
   alpha quality 100). The sheet is packed losslessly from the frames and then encoded once.
   `effects/sheets` ships WebP at quality 85: 3.02 MB becomes about 1.08 MB, and SSIM against the
   lossless sheet was 0.9976 or better over black, white and grey backgrounds.
2. `spriteSheet(id).url` follows the recipe through `assetFile()`, so the URL becomes `.webp`.
3. A `SpritePreload` service fetches all seven sheets once per page load. `GameBoard`, the one
   component behind the local game, the online game and the dev scenario pages, starts it when it
   is created. The fetch is fire and forget: it never delays the board, and a failure is ignored
   (the effect then loads its sheet as it does today).
4. A new content export, `SPRITE_IDS`, lists the sheets, so the service never keeps its own copy.

## Non-goals

- The six still pictures used by the Rules Wiki (`effects/stills`) stay as they are.
- No decoding on the main thread (`img.decode()`): the evaluation found no frame-pacing difference
  between PNG and WebP sheets at 1x, 4x and 6x CPU slowdown, so browsers' own lazy decode is enough.
- No waiting: the first hit is not held back until a sheet arrives.

## Anti-goals

- A sheet that looks different from today's (halo, fringing, a changed frame grid).
- Preloading on screens that never show a game (the preload starts with the board, not the app).
- The same sheet fetched twice by the preload and again by the effect (the preload goes through the
  browser's cache; the assets cache for a day).

## Calls made while writing (the author's)

1. **All seven sheets together, at board creation.** They are 0.34 MB in total as WebP, less than one
   skin screen, so choosing which to preload would cost more than it saves.
2. **`new Image()` with `src`**, through an injection token so a test can see the requests. A
   `<link rel="preload">` would add markup to a page for something only the board needs.
3. **Once per page load**, not once per board: a second game in the same tab finds the sheets cached.
4. **Quality 85**, the setting that was measured; lossless would keep 2.09 MB.

## Done when

1. Tests cover: the `sheets` recipe writing WebP (planner output path and extension validation, the
   conversion, rebuild when the quality changes), the preload service (one request per sheet, once
   only, nothing thrown when a request fails), `GameBoard` starting it, `SPRITE_IDS` matching the sheet
   data, and the shipped sheets staying close to a lossless rebuild.
2. The seven sheets in `assets/effects/sheets/` are WebP, the lock and the check pass, and a fresh app
   build ships them with no sheet `.png`.
3. Sizes before and after and the worst SSIM against the lossless sheet are measured on the real files
   and stated in the pull request, and a sheet with fine detail was looked at.
4. `npm run verify` and the whole test suite pass.
