# Sprite animations for seat effects

The hit pictures on a seat (Sha, fire, lightning, plain damage) become frame animations, and a
chain animation plays when a seat is chained. This replaces the static pictures on the game
board only; the Rules Wiki keeps the static PNGs.

## Rules

Which sprite plays, by what happened to the seat (the choice of picture is unchanged from the
2026-11-02 damage rules, `damageEffectsFor`):

| Effect | Sprite folder (`content/assets/sprites/`) |
|---|---|
| Sha, plain (`slash`) | `slash_red` |
| Fire Sha (`slash-fire`) | `fire_slash` |
| Lightning Sha (`slash-lightning`) | `thunder_slash` |
| Other plain damage (`damage`) | `damage` |
| Other fire damage, chained fire waves (`fire`) | `fire` |
| Other thunder damage, chained thunder waves (`lightning`) | `lightning` |
| A seat becomes chained (`chain`) | `chain` |

- **Chain:** plays on a seat at the moment it turns chained (a `ChainToggledEvent` with
  `chained: true`), on every seat the card turns chained, together with the chain badge
  appearing. Turning a seat unchained, by Chains again or by fire or thunder damage, plays nothing.
- Every effect shows over the seat's Generals area, appears at once, plays once and never
  blocks playback. A seat hit or chained again restarts its effect.
- The static PNGs in `content/assets/animation/` stay for the Rules Wiki's marks.

## Timing ("tuned")

Each folder's frames play as follows (the numbers are the ones previewed on 2026-11-02):

1. **Lead-in:** frames before the burst, 40 ms each. A sprite that starts as a small speck gets a
   pop: its first large frame scales up from 60% to 100% over 80 ms before it shows normally.
   Where that first large frame is is found by comparing the opaque area of the early frames.
2. **Burst:** the first 13/24 of the frames (rounded), 60 ms each.
3. **Tail:** the remaining frames, 40 ms each.
4. **Hold:** the last frame stays for 300 ms.
5. **Fade:** it fades out and shrinks to 90% over 400 ms, in CSS, not in the frames.

The effect is removed when its total time has passed. Under reduced motion no frame plays: the
sprite's peak frame shows still for the same time.

## Making the sheets

`scripts/build-sprite-sheets.py` packs each folder's frames into one PNG grid (`animation/sheets/<id>.png`) and
writes `sheets.json` with the frame count, grid, frame size, burst end, pop and peak frame.
Both are committed. The frame folders are not copied into the build; only the sheets are.
