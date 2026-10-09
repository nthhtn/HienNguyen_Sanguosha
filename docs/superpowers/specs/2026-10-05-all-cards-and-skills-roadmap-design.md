# Every Card and the Base Generals' Skills — Roadmap Spec

Status: Draft for review
Date: 2026-10-05

## Purpose

Make every remaining Basic, Equipment and Tool card playable, build the
General skills engine, and give the 25 base Generals their real skills. This
spec orders the work and holds the small pieces that need no spec of their
own. The big pieces live in:

- [Tools spec](2026-10-05-tools-design.md): the resolution queue, Wuxie
  checks, choices, judgments and every Tool.
- [Cards A spec](2026-10-05-cards-a-equipment-and-simple-cards-design.md):
  horses, Crossbow, Black Pommel, Silver Lion, Wine.
- [Sha-Equipment spec](2026-10-05-sha-equipment-design.md): Sha steps,
  abilities, conversions, the remaining weapons and armour.
- [General Skills spec](2026-10-05-general-skills-design.md): the skill
  engine and the 25 base Generals.
- [Peach and Dying spec](2026-10-05-peach-and-dying-design.md): built.

Decisions settled during brainstorming:

- **No elemental cards.** Fire Attack and Lightning Attack (the Fire and
  Thunder Sha) stay out of the deck. So do the cards that only make sense with
  elemental damage: Blaze, Chains and Fire Fan. Lightning deals plain damage.
  Wood Armor keeps its immunity; its fire weakness can't come up.
- **"May" always asks.** Every optional ability asks its owner each time it
  could apply, with Use and Don't.
- **Hidden Generals: reveal to use.** A hidden General's skills are off.
  Whenever an optional or active one could be used, it is offered as "Reveal
  X to use Y", and using it reveals that General. Compulsory skills of a
  hidden General don't apply.
- **Lord skills are inactive** in Kingdom War, which has no Lord: Escort,
  Fierce General and Rescued.
- **"Trick" is gone.** The term is "Tool" everywhere.
- **Seat avatar.** Each seat tile shows one split portrait: Main on the left,
  Deputy on the right.

## Stages

Each stage ends green: all tests pass, and seeded bot simulations at 2, 5
and 10 seats run to completion. Each stage gets its own implementation plan,
written just before it is built. A card joins the deck, at its printed
count, in the stage that makes its rules work.

| # | Stage | Spec |
|---|---|---|
| 0 | Rename Trick to Tool | this spec |
| 0b | Split-portrait seat avatar | this spec |
| 1 | Resolution queue and Wuxie checks. Draw Two, Barbarians, Hail of Arrows, Peach Garden. Duel on the Tool lifecycle. | Tools, stage 1 |
| 2 | Choices. Steal, Break, Harvest, Coerce. | Tools, stage 2 |
| 3 | Judgments. Capture, Lightning, Starvation. | Tools, stage 3, plus this spec |
| 4 | Horses (with Hua Liu), Crossbow, Black Pommel, Silver Lion, Wine (with self-rescue) | Cards A, plus this spec |
| 5 | Sha steps, abilities, conversions. Eight Trigrams, Black Shield, Wood Armor, Ancient Scimitar, Ice Sword, Axe, Longbow, Gender Swords, Green Dragon Blade, Sky Scorcher, Serpent Spear. | Sha-Equipment |
| 6 | Skill engine: reveal to use, gender, counters, new decisions | General Skills, part 1 |
| 7 | The 25 base Generals' skills | General Skills, part 2 |
| 8 | The Wind Generals' skills | [Stage 8 spec](2026-10-07-stage-8-wind-generals-design.md) |
| 9 | The Fire Generals' skills | [Stage 9 spec](2026-10-09-stage-9-fire-generals-design.md) |
| 10 | The Forest Generals' skills | its own spec, written before it is built |
| 11 | The Mountain Generals' skills | its own spec, written before it is built |

Out of scope: elemental damage with its cards. (Wind, Fire, Forest and
Mountain skills were added as stages 8–11 on 2026-10-07.)

## Stage 0: Trick becomes Tool

After this stage, "trick" appears nowhere in the repository except inside
crawled source URLs.

- **Engine:** `CardDefinition.category` is `'basic' | 'tool' | 'equipment'`.
- **Content data:** the folder `data/cards/trick/` becomes `data/cards/tool/`.
  `CardData.category` uses `'tool'`. Generated imports are renamed, for
  example `barbariansTool`.
- **Assets:** `assets/cards/trick/` becomes `assets/cards/tool/`, and
  `manifest.json` paths follow.
- **Scripts:** `assemble-content-data.py` and `restructure-content-data.py`
  write `tool`.
- **Code and tests:** every `'trick'` literal, identifier and comment.
  `cards/tricks.spec.ts` becomes `cards/tools.spec.ts`. The wiki route data,
  page-title map and tab map use `tool`.
- **Docs:** README, CLAUDE.md, and every spec and plan under
  `docs/superpowers/`, old ones included, say Tool. Spec and plan file names
  stay as they are, so links keep working.
- **Check:** `grep -rIi trick` over the repo, excluding `node_modules` and
  `dist`, finds only source URLs.

Behaviour doesn't change. The full test suite passes unchanged apart from
renames.

## Stage 0b: Split-portrait seat avatar

The seat tile's two separate General thumbnails become one avatar.

- **Layout:** one rounded frame with a border in the seat's force colour
  (yellow while unknown, as the tile border is today). Main's art fills the
  left half and the Deputy's the right. The halves touch, with a thin
  divider. Each half is cropped to the face and upper body
  (`object-fit: cover`, positioned to the top). Each half shows its General's
  name as a small caption at the bottom.
- **Hidden Generals:** another seat's hidden General arrives redacted as
  `hidden`. Its half shows the card back art, `generals/unnamed.jpg`, with
  the caption "Hidden".
- **Your own hidden General:** you see its real art, dimmed, with a small
  `visibility_off` mark and the caption "Name (hidden)".
- **Choosing:** while a seat is still choosing, the avatar shows the
  existing "Choosing Generals…" text in an empty frame.
- **Eliminated:** greyed with the rest of the tile, as today.
- **Info:** each half is a button. It opens the General's info, as the
  General selection screen does. A hidden half opens nothing.
- **Size:** the avatar keeps today's footprint (two 70×96 cards plus the
  gap, about 146×96), so crowded 10-seat tables keep their layout.
- **Text** follows CLAUDE.md's UI text style.
- **Tests:** the half order (Main left), hidden and own-hidden rendering, and
  the info button.

Stage 6 adds skill buttons under each half (see the General Skills spec).

## Amendments to the Tools spec (stage 3)

- **Lightning** deals 3 **plain** damage (`nature: 'normal'`) with no
  source.
- **Starvation** (delayed Tool) is new.
  - Placed in the judgment area of another living seat at distance 1
    (`seatDistance`, so horses count). A seat can't hold two Starvations.
  - In that seat's next Judgment Phase it is judged. Anything but a club
    means the seat skips that turn's **Draw Phase**. Starvation is then
    discarded.
  - If a Wuxie Kongjie cancels it, it is discarded without a judgment.
  - Engine: a `skipDraw` turn flag, handled by `advancePhaseOrTurn` like
    `skipPlay`.
  - Bots: place it on the non-ally in reach with the most hand cards.
  - Sim invariant: at most one Starvation per seat.
- **`UsedCard`**: the Tool lifecycle carries a `UsedCard` (Sha-Equipment
  spec), not a bare `CardInstance`, from stage 1 on. A Tool used through a
  conversion (Country Scene, Surprise) or a skill with no physical card
  (Sow Discord) then needs no change.

## Amendments to the Cards A spec (stage 4)

- **Hua Liu** is a defensive mount (+1), like Di Lu.
- **Printings** added by hand for the Army and EX equipment that has none,
  each marked `"printingsFrom": "army/EX printing list (manual, not crawled)"`:

  | Card | Printings |
  |---|---|
  | Hua Liu | ♦K |
  | Ancient Scimitar | ♠A |
  | Ice Sword | ♠2 |
  | Wood Armor | ♠2, ♣2 |
  | Black Shield | ♣2 |

  Fire Fan stays without printings and out of the registry.
- **Wine's self-rescue** (Wine's other use, from the Peach and Dying spec):
  - While **you** are dying, you may play a Wine on yourself to recover 1 HP.
    You can't use Wine to save another seat.
  - Engine: `DyingEffect.rescueCardIds` becomes
    `{ any: string[]; self: string[] }`. Kingdom War passes
    `{ any: ['peach'], self: ['wine'] }`. The dying seat's window allows both
    lists; other seats' windows allow `any`. The dying seat is asked even
    with neither, as today.
  - A Wine played as a rescue is a response. It sets no turn flag and
    doesn't count toward the one-Wine-per-turn limit.
  - Bots: a dying bot plays Wine on itself when it has no Peach.
  - UI: the dying prompt for yourself reads "Play a Peach or Wine to save
    yourself?" when you hold a Wine.
- **Deck from printings** is already built (each registry card's own
  printings, no expansion extras, and a card with none throws).
