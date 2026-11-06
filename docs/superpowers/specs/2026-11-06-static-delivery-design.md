# Static file delivery

What the server does when it serves the built Angular app and its assets
(`projects/server/src/http/staticFiles.ts`). Today it streams each file with a
`cache-control` header and nothing else. This stage makes delivery cheaper for
returning players and for slow connections, without changing any URL or any file.

Measured on 2026-11-05 against the real server code (see the "Asset Weight
Evaluation" artifact): JS is sent as 1.98 MB instead of about 0.5 MB, images and
audio are re-downloaded in full an hour after the last visit (no validators, so
no `304`), audio ignores `Range` requests (Safari reportedly expects `206` for
`<audio>`), and no response has a `Content-Length`. A further defect found while
writing this: the "hashed build file" pattern matches only 8-character hashes, so
24 of the 56 JS chunks (310 KB) are cached for an hour instead of a year.

## Goals

1. **Compression.** Text responses (`.html`, `.js`, `.css`, `.json`, `.svg`, `.txt`)
   of at least 1 KiB are sent as Brotli (quality 5) or gzip (level 6), chosen from
   `Accept-Encoding` (Brotli preferred), with `Vary: Accept-Encoding`. Images, audio
   and fonts are never compressed.
2. **Validators.** Every file response has `ETag` and `Last-Modified`. A matching
   `If-None-Match` (weak comparison, a list, or `*`) or, when there is no
   `If-None-Match`, an `If-Modified-Since` at or after the file's time gets `304` with
   no body.
3. **`Content-Length`** on every response that has a body, `HEAD` included.
4. **`Range`.** `Accept-Ranges: bytes` on every file response. A single range
   (`bytes=a-b`, `bytes=a-`, `bytes=-n`) gets `206` with `Content-Range` and the
   part's `Content-Length`; a range that cannot be satisfied gets `416` with
   `Content-Range: bytes */<size>`. Range responses are never compressed. Multiple ranges, or a
   header that is not a `bytes` range, are ignored and the whole file is sent. An
   `If-Range` that does not match the file's `ETag` or `Last-Modified` also gets the
   whole file.
5. **Cache policy.**
   - `index.html`, including a deep link answered with it: `no-cache` (now cheap,
     because it revalidates with `304`).
   - A hashed build file (`-<8 or 9 hash characters>.js|css|woff|woff2`): `public,
     max-age=31536000, immutable`. This replaces the 8-character pattern.
   - Everything else (images, audio, `favicon.ico`): `public, max-age=86400`.

## Non-goals

- No fingerprinted asset URLs. Images and audio keep their names, so a changed
  asset can take up to a day to reach a player who has the old one cached.
- No change to files, URLs, or the Docker image; no CDN; no Brotli precompression
  at build time.
- No range support for multiple ranges, and no compression of range responses.

## Anti-goals (a failure even if it technically works)

- A compressed body sent to a client that did not ask for it, or an `ETag`
  that makes a client keep a stale file after a deploy.
- Event-loop blocking: compression must be asynchronous.
- A path outside the static directory becoming readable, or the session cookie
  being touched by a static response (both are tested today and stay tested).

## Calls made while writing (the author's)

1. **Cache for assets: one day** (`max-age=86400`), then revalidate with `304`.
   Long enough that a normal week of play re-downloads nothing but a change, short
   enough that replaced art reaches players quickly without fingerprinting.
2. **ETag is weak** and built from size and modification time
   (`W/"<size hex>-<mtime ms hex>"`). A weak validator is correct across encodings,
   and the files in a deployed image never change under a running server.
3. **Compressed bodies are cached in memory** per file, encoding, size and mtime,
   so each file is compressed once per process. The set of build files is finite,
   so the cache is unbounded by design (about 0.5 MB for the current build).
4. **Brotli quality 5, gzip level 6:** about 505 KB and 537 KB for the current
   JS (measured), cheap enough for a 0.1 vCPU instance.
5. **Minimum size 1 KiB**, below which compressing costs more than it saves.
6. **Time comparison for `If-Modified-Since`** is at one-second resolution, since
   HTTP dates have no sub-second part.

## Done when

1. Tests cover each goal: compression chosen by `Accept-Encoding` (br, gzip,
   none, and not for images or small files), `Vary`; `ETag` and both conditional
   requests; `Content-Length` on `GET` and `HEAD`; each range form, `416`, multiple
   ranges, a wrong `If-Range`; and the three cache policies, including a 9-character
   and a `-`-containing chunk name taken from the real build.
2. Against a real build, `curl` shows `Content-Encoding: br` and a smaller transfer for
   the largest chunk, `304` on a repeat request with `If-None-Match`, and `206` for
   `Range: bytes=0-1023` on `audio/music/background.ogg`.
3. `npm run verify` and the whole test suite pass.
