# Assets folder restructure

A pure move: the same files, laid out by what they are, with consistent names. No file
content changes and no behavior changes. The masters-versus-derivatives split
(`assets-src/`) builds on this layout; it is specified in
`2026-11-06-assets-src-pipeline-design.md`, which moves the masters out of `assets/`.

## Why

`projects/content/assets/` was grouped by where files came from, not what they are:
`misc/` held unrelated UI pieces, `animation/` mixed still pictures with sprite sheets,
`generals/` mixed loose files with its subfolders, and `audio/` had fifteen uncategorised
files beside a per-General folder. Names mixed `_` and `-`, and the URL prefix `/card-art/`
also served UI and sprites.

## Rules

1. The top-level folder says what the file is (Generals, playing cards, effects, UI, audio).
2. Every folder and file name is kebab-case.
3. A file's name matches the id the code uses. The one exception is Skin files, which are
   the pinyin without hyphens (`caocao.png`), mapped by `generals/skins/skins.json`.
4. Nothing sits loose in a folder that also has subfolders.
5. Files that do not ship (`effects/frames/`) are excluded in `angular.json` in one place.
6. Images are served under `/images/`, audio under `/audio/`.

## Layout

```
assets/
  generals/
    skins/<force>/<pinyin>.png        skins.json stays here
    cards/<force>/<id>.jpg
    special/                          hidden.jpg, placeholder.svg, ambitionist.jpg, ambitionist-icon.png
  playing-cards/
    full/<card-type>/...              basic/, tool/, equipment/{weapon,armor,horse}/
    cropped/<card-type>/...           same subfolders
    back.jpg
  effects/
    sheets/                           shipped sprite sheets and sheets.json
    stills/                           single pictures the Rules Wiki uses
    frames/<effect>/<n>.png           source frames, not shipped
  ui/
    banners/  hp/  chain/  battlefield/
    brand/                            logo.png, landing.jpg, favicon.ico
  audio/
    music/                            background.ogg, win.ogg
    effects/                          injure, injure-hard, injure-element, chained, peach, weapon, armor, horse, pop-up
    death/forces/                     wei.ogg, shu.ogg, wu.ogg, qun.ogg
    death/generals/<force>/<pinyin>.ogg
    voice/{male,female}/<card>.ogg
  manifest.json
  README.md
```

## Moves

| From | To |
|---|---|
| `cards/{basic,tool,equipment}/**` | `playing-cards/full/**` |
| `cards/cropped/**` | `playing-cards/cropped/**` |
| `cards/back.jpg` | `playing-cards/back.jpg` |
| `cards/skins/back.png`, `unknown.png` | deleted (nothing references them) |
| `generals/{ambitionist,hidden}.jpg`, `placeholder.svg`, `ambitionist_icon.png` | `generals/special/` (`ambitionist-icon.png`) |
| `animation/sheets/**` | `effects/sheets/**` |
| `animation/<id>.png` | `effects/stills/<id>.png` (`slash_fire` to `slash-fire`, `slash_lightning` to `slash-lightning`) |
| `sprites/<folder>/` | `effects/frames/<folder>/` (`slash_red` to `slash-red`, `fire_slash` to `fire-slash`, `thunder_slash` to `thunder-slash`, `slash_black` to `slash-black`) |
| `banner/*` | `ui/banners/*` |
| `misc/hp/*`, `misc/battlefield/*` | `ui/hp/*`, `ui/battlefield/*` |
| `misc/chain.png`, `chain_left.png`, `chain_right.png` | `ui/chain/chain.png`, `chain-left.png`, `chain-right.png` |
| `misc/{logo.png,landing.jpg,favicon.ico}` | `ui/brand/` |
| `audio/{background,win}.ogg` | `audio/music/` |
| `audio/{injure,injure_hard,injure_element,chained,peach,weapon,armor,horse,pop-up}.ogg` | `audio/effects/` (`injure-hard`, `injure-element`) |
| `audio/death_<force>.ogg` | `audio/death/forces/<force>.ogg` |
| `audio/death/<pinyin>.ogg` | `audio/death/generals/<force>/<pinyin>.ogg` |
| `audio/{male,female}/**` | `audio/voice/{male,female}/**` (`fire_slash` to `fire-slash`, `thunder_slash` to `thunder-slash`) |

## Death voices by force

The force of a death voice is the force in `skins.json` for the Skin of the same name.
All 66 Skin names belong to exactly one force, so the placement is unambiguous, and the
lookup becomes `/audio/death/generals/<skin path without extension>.ogg`.

Eight voice files have no Skin and belong to Generals who are not in the data yet:
`caohong`, `hetaihou`, `jiangqin`, `lidian`, `madai`, `xusheng`, `zangba`, `zhangren`.
They were unreachable before (the lookup needs a Skin) and stay unreachable. They are
filed under the force these Generals have in the standard game (Wei, Qun, Wu, Wei, Shu,
Wu, Wei, Qun), to be confirmed when each General is added.

## Code

- Every URL is built in `projects/content/src/lib/assets.ts`, except CSS and templates,
  which carry the literal path.
- `angular.json` globs follow the new folders, and the image output folder `card-art`
  becomes `images`. The favicon is still copied to the site root.
- `manifest.json` `localPath` values for playing cards change to `playing-cards/full/...`.
  The cropped URL swaps `full/` for `cropped/`.
- `scripts/build-sprite-sheets.py` reads `effects/frames/` and writes `effects/sheets/`.
- The `add-general` and `add-general-skill-preview` skills, `docs/architecture`, and the
  assets README follow the new paths. Historical plans and specs are left as written.

## Guards

- The multiset of file contents (hashes) is identical before and after, apart from the two
  deleted files and a changed `manifest.json`.
- A test fails when any `/images/...` or `/audio/...` path written in app or content source
  points at a file that does not exist.
- `npm run verify` and the tests pass.

## Out of scope

Resizing and re-encoding, `assets-src/`, the three `.ogg` files that hold MP3 data, and
filling the provenance gaps in `manifest.json` (nine General cards have no record).
