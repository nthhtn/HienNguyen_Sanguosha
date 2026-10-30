# Building blocks

Taken from the films built on 2026-10-29 and 2026-10-30. Everything on screen is a pure function of `t` (seconds): set every varying style from `t` inside `render`, with no timers, transitions or random. Class names in a scene start with `demo-`. A line of words is one string in one element.

## The film's documents

The end state is these five documents, written in one `ArtifactData` batch with `"stage":"final"` and `film/script` last, as the films so far did. Where the Motion type's own instructions ask for something else (a rough stage first, a page to read), follow the type and end in the same state.

| Document | Holds |
|---|---|
| `film/meta` | `{"v":1,"title":"...","updatedAt":"..."}` |
| `modules/scenes.json` | JSON text: `v`, `stage`, `look`, `palettes` (the four colors), `theirs:0`, `width`, `height`, `fps:60`, `background` (the ground), `fonts`, `scenes:[{id:"demo",name,dur,desc}]` |
| `modules/base.css` | [base.css](base.css) with the first line's colors swapped per look.md |
| `film/script` | `{"code":"window.CUT = kit.scenes();"}` |
| `modules/scene-demo.js` | the scene, see [example-scene.js](example-scene.js) |

Create the film with the `Artifact` tool (a `quickstart` call with intent `other` names the Motion type), a `title` of two to four words naming the General and the skill, and `auto_open: "after_first_write"`. Edit later with `str_replace` and the document's `if_version`.

## Pieces

```js
const { seg, eo, eio, lerp } = kit;   // seg(t,a,b): 0..1 across a..b
// Place a 130x182 card by its center; sx squashes it for a flip.
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };

// Flight with an arc, then a flip that swaps back and face at the middle.
const p = eio(seg(t, 0.4, 1.2));
place(card, lerp(x0, x1, p), lerp(y0, y1, p) - Math.sin(Math.PI * p) * 90, lerp(0.74, 1, p), lerp(0, -5, p));
const f = seg(t, 2.5, 3.0), up = f >= 0.5, sx = Math.abs(1 - 2 * f);   // back.opacity = up ? 0 : 1; face.opacity = up ? 1 : 0

// A swap: two cards run the same eio(seg()) in opposite directions, one arcing up and one down.

// Chain legs (row, then zone, then final): x2 = lerp(x1, zoneX, p2); x3 = lerp(x2, finX, p3). Each p is 0 before its leg and 1 after.

// Shake a panel on a hit, and float a damage number.
panel.transform = 'translateX(' + (t > t0 ? Math.sin((t - t0) * 55) * 14 * (1 - seg(t, t0, t0 + 0.6)) : 0) + 'px)';
pop.opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3)));
pop.transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)';

// HP: each pip holds an inner <i>; empty it with opacity. A label that can go below 0 flips its text: hp.textContent = t < t0 ? 'HP 1' : 'HP 0'.

// Draw-on line (arrow, bolt, cross): <path pathLength="1" style="stroke-dasharray:1 1">, then
path.strokeDashoffset = 1 - eo(seg(t, a, b));  path.opacity = t < a ? 0 : 1 - eio(seg(t, c, d));

// Captions: one window per beat [inStart, inEnd, outStart, outEnd], stacked at the same spot.
win.forEach((w, i) => { const inn = eo(seg(t, w[0], w[1])); cap[i].opacity = inn * (1 - eio(seg(t, w[2], w[3]))); cap[i].transform = 'translateY(' + lerp(18, 0, inn) + 'px)'; });
```

## Gotchas

- Suit glyphs inside the JSON text of a document are written `\\u2660` (♠), `\\u2663` (♣), `\\u2665` (♥), `\\u2666` (♦). ♥ and ♦ get class `red`.
- Single-quote the markup strings and double-quote `style="..."`, with no quotes inside a style value.
- Every card that moves is a `.sha` (130×182) placed with `place`. A moving face-down card is `.sha.bk` at scale 0.74, never a `.cback`: `.cback` (96×130) is only for static hand backs positioned by `left` and `top`, and `place` would put it off-center.
- A card moving from one seat's hand to another is an ordinary flight between two slot centers, with the hand labels changing at the start and the end.
- Two `str_replace` calls on one document in parallel conflict: each needs the version the last one returned. Put both changes in one `old_str`.
- A seat tag must not overlap the cards that fly from it. Check the widest name (`Elder Zhuge Liang`, `Người chơi 1`) against the card row.
- The scene file is about 6 to 9 KB. If a skill needs much more, it has too many beats.
