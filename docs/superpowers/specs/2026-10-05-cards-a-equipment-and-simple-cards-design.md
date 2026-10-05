# Cards A — Equipment Abilities and Simple Cards — Design Spec

Status: Draft for review
Date: 2026-10-05

> **Amended (2026-10-05):** the [roadmap spec](2026-10-05-all-cards-and-skills-roadmap-design.md) makes this spec stage 4 and adds **Hua Liu**, the Army/EX equipment printings and **Wine's self-rescue**. Its `triggers` and `EquipmentAbility` fold into `abilities` ([Sha-Equipment spec](2026-10-05-sha-equipment-design.md)). Deck from printings is already built. The roadmap at the end is superseded by the roadmap spec.

## Purpose

Make the first batch of the remaining crawled cards playable, and give
equipment a real way to carry abilities. This is sub-project **A** of the
"every card playable" effort (roadmap at the end).

Today 7 cards are in the deck: Sha, Shan, Peach, Duel, Wuxie, Silver Lion and
Green Dragon Blade. Equipment can be worn but has no abilities beyond weapon
range and mount distance. The deck holds 4 copies of each card, with made-up
suits and ranks.

Decisions settled during brainstorming:

- **Fidelity:** faithful rules, delivered in phases. A card joins the deck
  only once its rules really work. A card whose full rules need a later
  sub-project joins now only if the missing part is a separate use that can
  wait. Wine's dying rescue (E) and Wuxie windows on tricks (B) are such parts.
- **Order:** A → B → E → C → D → F (roadmap below).
- **Deck:** built from each card's real printings in the data, exactly the
  printed quantity of each card at every table size.
- **Equipment abilities:** equipment cards carry their own triggers, and
  content-side rule modifiers are declared per card. Two rejected
  alternatives: rule queries that check card ids (a central registry of
  content, which CLAUDE.md forbids), and turning equipment into a
  pseudo-general (it muddles the domain model).
- **Silver Lion's ability is in scope**, so Black Pommel's ability has
  something to act on.

## Rule text

Precise rules for every card this sub-project adds or changes. "Your" means
the seat playing or wearing the card. All new cards are played only in their
owner's Play phase, like every card today.

### Horses (6 cards)

- **Defensive mounts (+1): Di Lu, Shadow Runner, Storm Runner.** Equip into the
  `defensiveMount` slot. While worn, every other seat's distance *to* you is 1
  greater.
- **Offensive mounts (−1): Red Hare, Da Yuan, Zi Xing.** Equip into the `offensiveMount`
  slot. While worn, your distance *to* every other seat is 1 smaller
  (never below 1).
- Equipping follows the existing one-card-per-slot rule: whatever already
  fills that slot goes to the discard pile first. The slot comes from the
  data file's `mount` field. The distance rule is already in
  `seatDistance`.

### Crossbow (weapon, range 1)

While worn, you may play any number of Sha in your Play phase. The usual
limit is one per turn.

The limit is checked at the moment you play. Equip Crossbow after your first
Sha and you may play more. Lose it after playing one and the one-per-turn
limit applies again: a further Sha is legal only while fewer than the
limit's worth have been played this turn.

### Black Pommel (weapon, range 2)

While worn, the target's armour has no effect on damage dealt by your Sha.
In this sub-project the only armour with an effect is Silver Lion. Eight
Trigrams joins in D.

### Silver Lion (armour), its ability is new

- **Damage cap:** when you would take damage greater than 1, you take 1
  instead. This doesn't apply to damage from a Sha whose user wears Black
  Pommel.
- **Parting heal:** when Silver Lion leaves your equipment for any reason
  (replaced by another armour, or later taken or discarded by another card),
  you recover 1 health, up to your max. This happens after the move.

### Draw Two (trick)

Play it with no target. You draw 2 cards.

Wuxie can't negate it yet. Sub-project B adds a Wuxie window to every trick
at once, Draw Two included.

### Wine (basic)

- You may play at most **one Wine per turn**, with no target.
- **Effect:** the next Sha you play this turn deals 1 extra damage.
- **Used up:** the boost is spent the moment you play a Sha, even if the Sha
  is then dodged. It lapses unused at the end of your turn.
- Wine doesn't affect a Sha played as a response (e.g. answering a Duel).
- Wine's other use, rescuing a seat on the brink of death, arrives with the
  dying state in sub-project E. Until then Wine can't be played outside your
  Play phase.

### Interactions worth stating

- Wine-boosted Sha (2 damage) against Silver Lion deals 1. With Black Pommel
  it deals 2.
- Duel's damage (currently 2 in this engine) is capped to 1 by Silver Lion.
  Black Pommel doesn't help, because Duel isn't a Sha.
- The Sha limit counts only proactive plays (`turn.cardPlays.sha`), as it
  does today.

## Engine changes

### 1. Equipment triggers

```ts
// registry/types.ts
export interface CardDefinition {
  // ...unchanged...
  // Active while the card sits in a seat's equip zone; the wearer is the owner.
  triggers?: SkillTrigger[];
  // Resolved for the former wearer right after the card leaves an equip zone.
  onUnequip?(state: GameState, ctx: { seatId: string; cardInstanceId: string }): unknown[];
}

export type TriggerOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
```

- `gatherTriggeredSkills` gathers in this order: mode triggers, then general
  skills, then the triggers of every card in a living seat's equip zone, in
  seat order and then zone order.
- Existing general skills now receive `kind: 'general'`. Every current
  reader of `owner.slot` narrows on `kind`.
- **`onUnequip`:** when a `MoveCardEffect` moves a card out of a zone of kind
  `equip`, `resolveEffectWithTriggers` does two things in order. First it runs
  the move's own after-triggers. Then it resolves the card's `onUnequip`
  effects for the former wearer (the equip zone's `ownerSeatId`). A trigger
  can't do this job: once the card has left, its triggers are no longer
  gathered.
- `CardMovedEvent` gains `fromZoneId`, so the log and triggers can tell where
  a card came from. The face-up `card` field added for the discard history
  stays.

### 2. Turn flags

```ts
export interface Turn {
  // ...unchanged...
  // Per-turn markers set by content (e.g. 'wine'); a new Turn starts without them.
  flags?: Record<string, boolean>;
}

// effects.ts
| { kind: 'SetTurnFlagEffect'; flag: string; value: boolean }
```

`SetTurnFlagEffect` sets or clears one flag on the current turn. It logs no
event, because it has no public meaning of its own; the Wine play is already
logged as a card play. Both `advanceTurn` branches already build a fresh
`Turn`, so flags lapse at turn end. A test pins this.

No other engine change. Sha limit, armour bypass and Wine's damage are
content rules (below).

## Content changes

### Equipment helper

`makeEquipmentCard` takes an optional `ability`:

```ts
interface EquipmentAbility {
  shaLimit?: number;         // Crossbow: Number.POSITIVE_INFINITY
  ignoresArmor?: boolean;    // Black Pommel
  triggers?: SkillTrigger[]; // Silver Lion's damage cap
  onUnequip?: CardDefinition['onUnequip']; // Silver Lion's parting heal
}
```

These are recorded in a content-side map keyed by definition id, next to the
existing `EQUIP_SLOT_BY_ID`, because `play()` and trigger conditions get no
registry. The shared queries read the abilities of whatever is equipped.
They never name a card:

- `shaLimit(state, seatId, registry)`: the highest `shaLimit` among the
  seat's equipped cards, else 1.
- `armorIgnored(state, damage)`: true when the damage's cause is a Sha card
  and the source seat has equipment with `ignoresArmor`. The Sha card is
  found by instance id in any zone; at damage time it is usually in the
  discard pile.

### New card definitions

- `horses.ts`: six mounts built with `makeEquipmentCard`, slot taken from
  `cardsData[id].mount`.
- `crossbow`, `black-pommel`: weapons with range from the data and the
  abilities above.
- `silver-lion`: gains a `before:DamageEffect` trigger. Its condition: the
  target is the wearer, the amount is over 1, and `armorIgnored` is false. It
  rewrites the amount to 1. Its `onUnequip` returns a 1-point `HealEffect`
  for the former wearer.
- `draw-two.ts`: `legalPlayTargets → [[]]`, `play →` one `DrawCardsEffect`
  of 2 for the player.
- `wine.ts`: `legalPlayTargets → [[]]` while `cardPlays.wine` is under 1,
  else `[]`. `play →` `SetTurnFlagEffect('wine', true)`.
- `sha.ts`: on a proactive play, damage is `1 + (turn.flags.wine ? 1 : 0)`.
  When the flag is set it also emits `SetTurnFlagEffect('wine', false)`
  first.

### Card data

- **Equipment printings:** the crawled equipment files have no printings.
  They are added from the standard-edition printing list. Each file's
  `source` is marked
  `"printingsFrom": "standard-edition printing list (manual, not crawled)"`
  so they can be checked against a real deck:

  | Card | Printings |
  |---|---|
  | Crossbow | ♣A, ♦A |
  | Black Pommel | ♠6 |
  | Gender Swords | ♠2 |
  | Green Dragon Blade | ♠5 |
  | Serpent Spear | ♠Q |
  | Axe | ♦5 |
  | Sky Scorcher | ♦Q |
  | Longbow | ♥5 |
  | Eight Trigrams | ♠2, ♣2 |
  | Silver Lion | ♣A |
  | Di Lu | ♣5 |
  | Shadow Runner | ♠5 |
  | Storm Runner | ♥K |
  | Red Hare | ♥5 |
  | Da Yuan | ♠K |
  | Zi Xing | ♦K |

  All weapon, armour and horse files get printings now, including cards that
  join later, so the data is complete in one pass.
- **Silver Lion data file:** add `equipment/armor/silver-lion.json` (name,
  Chinese name, rule text, printing). Register it in `data/cards/index.ts` so
  the wiki and the card-info dialog show its text.

### Deck from printings

`buildDeckSpec` puts exactly one card per printing for every registry card:
the deck holds each card's printed quantity, at every table size. There are
no extra copies for big tables. A 10-seat table deals 40 of the cards and
relies on the existing reshuffle to keep drawing.

A registry card with no printings throws at setup. That is a data error and
shouldn't silently drop out of the deck.

With A shipped, the deck has 30 Sha, 15 Shan, 8 Peach,
3 Duel, 3 Wuxie, 5 Wine, 4 Draw Two, and 1 or 2 of each equipment card. That
is 79 cards.

## Bots (rule-based)

- **Equip:** as today, equip only into an empty slot. Horses and the new
  weapons fall out of this rule automatically.
- **Draw Two:** always played, before any attack.
- **Wine:** played only when a Sha play is legal right now and Wine hasn't
  been played this turn. The Sha follows as the next action.
- **Sha count:** the bot's `shaPlayed === 0` memory check is dropped. It
  plays a Sha whenever the engine offers one at a non-ally, so Crossbow lets
  it fire repeatedly. The existing safety cap still ends the turn.
- **Discard ranking:** Wine and Draw Two rank with Sha (2). Equipment stays
  at 1.

## UI

No new controls: every card here is a plain play or equip, and seat tiles
already show all four slots.

- The game log names the new moves through the existing labels.
- `CardMovedEvent` labels may use `fromZoneId` when the card is face-up.
- Card art and info text come from the data as for other cards.

## Testing

- **Engine:**
  - Equipment triggers are gathered only while equipped, in the stated order,
    and with an `equipment` owner.
  - `onUnequip` fires after a card leaves an equip zone, and not for other
    moves.
  - `SetTurnFlagEffect` sets and clears a flag, and a new turn starts without
    flags.
  - `CardMovedEvent.fromZoneId` is present.
- **Content:**
  - One test per rule bullet above: horse distance, Crossbow mid-turn
    equip/unequip, Wine boost consumed on a dodged Sha, Wine once per turn.
  - Silver Lion cap with and without Black Pommel; Silver Lion vs Duel;
    parting heal when replaced, and no heal above max.
  - Deck built from printings, with counts and scaling; a missing printing
    throws.
- **Bots:** Wine then Sha, Draw Two played, repeated Sha with Crossbow.
- **Sim:** the headless simulation harness runs a batch of seeded bot games
  to completion without errors.

## Out of scope (later sub-projects)

> **Superseded in part (2026-10-05):** sub-projects B, C and D below are now
> covered, reordered, by the [Tools spec](2026-10-05-tools-design.md), which is
> built before this one. Its turn flags are the ones described here.

| Sub-project | Delivers |
|---|---|
| **B** | A resumable resolution queue. Barbarians, Hail of Arrows, Peach Garden, Harvest. Wuxie windows on every trick (chainable). |
| **E** | The dying state and a rescue window for everyone: Peach on others, Wine on yourself. |
| **C** | A generic "choose a card / choose an option" decision, with UI and bot support. Steal, Break, Coerce, Longbow, Gender Swords, Axe. |
| **D** | Judgments and the judgment zone: Lightning, Capture, Eight Trigrams. |
| **F** | Cards used as other cards, and extra targets: Serpent Spear, Sky Scorcher, Green Dragon Blade's follow-up attack. |

Green Dragon Blade stays a plain range-3 weapon until F.

**Done ahead of B (2026-10-05): the alternating Duel.** Starting with the
target, the two seats take turns playing a Sha, and the first who doesn't
takes 1 damage from the other. Wuxie Kongjie from the target before any Sha
cancels it, and Duel Shas don't use up the turn's Sha play. It is built on a
general engine hook: a response window records the card that opened it
(`PendingResponse.sourceCard`), and that card's `onResponse` decides what an
answer leads to. Barbarians and Hail of Arrows can reuse this hook in B.
