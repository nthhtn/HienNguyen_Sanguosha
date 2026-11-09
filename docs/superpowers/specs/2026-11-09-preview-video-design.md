# Preview videos at the size the Wiki shows them

The 12 skill preview videos are 1920 x 1080 at 60 fps, H.264, about 530 kbps and 5.63 MB in
total. The Wiki player is at most 480 CSS px wide (`.preview { max-width: 480px }`), 960 x 540
even on a 2x screen, and a video loads only when a reader presses play. Measured on 2026-11-09 by
re-encoding two of them: 960 x 540 at 60 fps, CRF 24, preset slow is 74 to 77% smaller (806 KB to
207 KB, 340 KB to 78 KB) with SSIM 0.997 against the original scaled to the same size. The
developer chose to keep 60 fps, because the animations are built at 60.

## Goals

1. A new recipe op, `video`, re-encodes a master video with `ffmpeg` (libx264). Fields: `ext`
   (`mp4`), `maxWidth` (scale down keeping the aspect ratio, even dimensions, never up), `fps` (a cap:
   a faster source is reduced to it, a slower one is left alone), `crf` (default 24) and `preset`
   (default `slow`). The copy is always yuv420p, fast-start (the index first, so playback starts at once)
   and silent (the previews have no audio).
2. The `preview` recipe becomes `{ "op": "video", "ext": "mp4", "maxWidth": 960, "fps": 60, "crf": 24,
   "preset": "slow" }`, and `preview/index.json` keeps its own `copy` recipe. The masters in
   `assets-src/preview/` stay as rendered; the build ships a right-sized copy.
3. `ffmpeg` is needed to build, never to check: `npm run assets:check` stays standard-library Python
   and compares hashes only. Without `ffmpeg` a build fails with one clear message that names the output
   and says how to install it. The video tests skip when `ffmpeg` is missing, and CI installs it so they run.

## Non-goals

- No new master: the existing masters are lossy encodes themselves, so re-encoding adds a little loss
  (measured in the SSIM above). Re-rendering the films at 960 x 540 from their sources would be cleaner but
  the film sources are not on disk.
- No audio, no other codec (H.264 only: every browser plays it), no 30 fps variant.
- No change to the URLs, the index, or the Wiki.

## Anti-goals

- A video that looks worse than the player can show (blur, blocking, a changed frame rate).
- A copy that does not seek (no fast-start) or that Safari cannot play (not yuv420p H.264 in MP4).
- The check needing `ffmpeg`, or a missing `ffmpeg` giving a traceback.

## Calls made while writing (the author's)

1. **960 x 540, 60 fps, CRF 24, preset slow:** the measured setting; CRF 28 saves another 25% at SSIM 0.9958 and is
   one recipe line away.
2. **Even height by construction** (`-2` keeps the aspect ratio and an even number), because H.264 in yuv420p needs it.
3. **The frame rate is probed** with `ffprobe` rather than relying on an `ffmpeg` option that older versions lack.
4. **Masters accepted:** `.mp4`, `.mov` and `.webm`; the copy is always `.mp4`.

## Done when

1. Tests cover: planning a `video` recipe (output path, unreadable master, unsupported target, invalid
   `maxWidth`, `fps`, `crf` or `preset`), the conversion (size, aspect ratio, never scaled up, frame rate
   capped but never raised, H.264 yuv420p, no audio, fast-start), the build (rebuilds when `crf` changes, passes
   the check), and a missing or failing `ffmpeg` giving a clean error that names the output.
2. All 12 shipped videos are at most 960 px wide at 60 fps, the lock and the check pass, and a fresh build ships
   them in their force folders.
3. Sizes before and after and the lowest SSIM against the master (scaled to the same size) are measured on
   the real files and stated in the pull request, and the worst one was looked at.
4. `npm run verify` and the whole test suite pass.
