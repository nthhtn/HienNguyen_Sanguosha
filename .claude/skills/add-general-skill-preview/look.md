# Look, layout and wording

Values were taken on 2026-10-30 from the films for Cao Cao, Zhang Jiao, Zhou Tai and Elder Zhuge Liang. Check the force colors against `projects/app/src/styles.scss` (`--force-wei` and the other three) before using them, since the app may change them.

## Look

Flat cards sliding across a dark table, one caption per step, silent, 1920×1080 at 60 fps, one scene with id `demo`.

| Force | `--main` | `--ground` | `--second` | Played by (so far) |
|---|---|---|---|---|
| Wei | `#3f6fd8` | `#0F2233` | `#E6EEF5` | Cao Cao |
| Shu | `#d84a3f` | `#2B1613` | `#F6EBE8` | Elder Zhuge Liang |
| Wu | `#2f9e58` | `#0E2A1D` | `#E8F3EC` | Zhou Tai |
| Qun | `#8a7f8c` | `#1E1B24` | `#EFEAF1` | Zhang Jiao |

- `--accent: #E0A93B` in every film, for what happens: a lit skill chip, a target ring, an arrow, the damage number. `--red: #C9483F` only for ♥ ♦ and the Brink of Death chip. Ambitionist and no-force colors are not used.
- Fonts in `scenes.json`: display `{"family":"Zilla Slab","or":"fraunces-display"}`, sans `"instrument-sans"`.
- No portraits or card art, only panels, flat cards and captions (decided 2026-10-30). The Wiki page already shows the General, and an image adds weight and breaks on Generals without a skin.
- Every seat in the film uses the owner's force colors. Other seats have no force.
- If the app's force color differs from the table, use the app's and say so in the hand-over.
- A card whose identity is hidden or random (taken at random from a hand) stays face down. Show a face only when the rule makes it public.
- Skill chips: dim chip with a gold copy over it, faded in when the skill triggers. Compulsory skills are lit from the start.

## Layout (stage pixels)

| Thing | Where |
|---|---|
| Owner panel | `left:140, width:560`, top 170 to 220, height 340 to 580 |
| Other seat | a panel `left:1200, top:300, 560×260` when it only receives a hit or a judgment; a tag `left:1160, top:170, 640×220` when cards fly from it. The tag's cards are 0.74 scale at x = 1260, 1372, 1484, y = 300 |
| Card | 130×182. In a hand 0.74 scale (96×135) |
| Hand slot centers | x = 224 + 112 n (n = 0, 1, 2, 3 gives 224, 336, 448, 560), y = panel top + 411. Static hand backs are `.cback` at `top:346` inside the panel |
| Hand count | `Hand n` label inside the seat, `left:36`, just above the cards. It changes when a card arrives or leaves |
| Draw Pile | center (1650, 300) beside the panel, or (960, 590) at the table's center |
| Judgment card | center (1480, 180), above Seat 2, with a `Judgment` label above |
| Zones | dashed outlines 360×240, label inside at the top |
| Caption | `left:140, top:810, width:1640`, display bold 66 px (56 px in Vietnamese) |

HP is pips (44 px) plus an `HP n` label when HP can go below 0. Show at most four pips.

## Timing

Flight 0.5 to 0.8 s with an arc, flip 0.4 s (scaleX to 0 and back, the face swaps at the middle), caption in 0.4 s and out 0.3 s, shake `sin(55 t)` of 14 px fading over 0.6 s. Nothing flashes more than three times a second. The film ends on a held final state of at least 1.2 s.

## Wording

- Visible text follows CLAUDE.md "UI text style": Title Case for names and labels (`Draw Pile`, `Judgment`, `Under General`), sentence case for captions. Keep capitals on player, General and card names, forces, `HP`, `Start Phase`.
- Seats read `Seat 1`, never `seat-1`. Skill names are the deck data's (`Refuting Death`, not the engine's `Refusing Death`).
- A caption is 45 characters or fewer in English, one line, one per beat.
- No pronoun for a General: write the name.

## Vietnamese

Every skill gets a Vietnamese film beside the English one, the same scene and timing with Vietnamese captions. The film's title is the Vietnamese General and skill name. Names and terms come from `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` and `projects/content/data/locales/vi/kingdom-wars-generals.json` (Sinh lực, Sát, Chồng bài rút, Người chơi 1, Cận kề cái chết). Sentence case everywhere. The English fonts lack Vietnamese letters: use display `Merriweather` and sans `Be Vietnam Pro`, each with weights `[400,700]`, and give the seat tag more room (`Người chơi 1` is wide). Captions are draft: say so in the hand-over.
