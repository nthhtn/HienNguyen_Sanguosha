# Equipment Slots and Discard Pile Display — Design Spec

Status: Approved for implementation planning
Date: 2026-10-01

## Purpose

Give every seat a proper equipment area with four slots (weapon, armor, +1
mount, −1 mount), enforced by the real one-card-per-slot rule. Also make the
discard pile on the table show the card most recently discarded, updating as
each event lands.

Today a seat's equip zone is a flat list with no slots. Equipping a second
weapon simply stacks it next to the first, and the table centre shows only a
discard count.

Decisions settled during brainstorming:

- **Scope:** the real slot rule, with the existing playable equipment only.
  - Green Dragon Blade is a `weapon`.
  - Silver Lion is `armor`.
  - The other crawled equipment (7 weapons, Eight Trigrams, and the 6 horses)
    stays out of the deck. Each needs its own rule text, especially mount
    distance effects.
- **Approach:** the slot is declared on each card definition. The replacement
  happens inside the equipment card's own `play()`, built by content's
  equipment helper, so the engine pipeline is unchanged. Separate engine zones
  per slot and a new engine effect were both rejected as larger changes for
  the same behaviour.
- **Discard display:** UI-only (discarded cards are public information).

## Engine change (type only)

```ts
// projects/engine/src/lib/registry/types.ts
export type EquipSlot = 'weapon' | 'armor' | 'plusMount' | 'minusMount';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'plusMount', 'minusMount'];

export interface CardDefinition {
  // ...unchanged...
  equipSlot?: EquipSlot; // required for category 'equipment', absent otherwise
}
```

## Rule text

1. Every `CardDefinition` with `category: 'equipment'` declares exactly one
   `equipSlot`. Non-equipment cards declare none. The content registry test
   enforces both.
2. **Playing an equipment card** (`PlayCardAction`, from the player's own hand,
   no target) resolves as an ordered list of effects:
   1. If the player's equip zone holds a card whose definition has the same
      `equipSlot`, add `MoveCardEffect` for that card to the discard pile. The
      discard pile is located by zone kind, as the engine already does.
   2. Add `MoveCardEffect` for the played card to the player's equip zone.

   Both are ordinary effects. They resolve through the pipeline, are logged as
   `CardMovedEvent`, and fire `before:` / `after:` triggers like any other move.
   The engine's existing post-play discard already exempts equipment cards, so
   the played card stays equipped.
3. Cards in **other** slots are untouched: a weapon and an armor coexist.
4. **Invariant:** a seat's equip zone never holds two cards with the same
   `equipSlot`. The sim's `checkInvariants` (given the registry) reports any
   violation.
5. **Bots:** the rule-based policy equips an equipment card only if the bot's
   equip zone has no card in that card's slot. This replaces "only if that
   exact card isn't already equipped". A bot never swaps a weapon for a weapon.

Implementation note: `play(state, ctx)` has no registry access. Content's
equipment helper therefore owns a lookup, `equipSlotOf(definitionId)`, built
from the same list of equipment definitions it creates. This is the single
source for each card's slot, and it lets the helper determine the slot of the
card already equipped. `content` also exports the lookup, for the UI.

## UI

- **Seat tile, on every seat (equipment is public):** a row of four slot boxes,
  in the order Weapon, Armor, +1 Horse, −1 Horse.
  - A filled slot shows the equipped card's art (small `CardArt`), with the
    card name as its label.
  - An empty slot shows a faint Material icon placeholder with the slot name as
    its title: `gavel` for Weapon, `shield` for Armor, and `add` / `remove` for
    the horses.
  - Slot assignment uses `equipSlotOf` from `content`. A card with no known
    slot can't occur in a valid state, and is ignored for display.
- **Round table centre:** the discard pile is shown face-up.
  - The pile's most recent card is the **last** card of the discard zone,
    because `moveCard` appends.
  - It renders as a small `CardArt` with the caption "Last discarded: <name>",
    next to "Discard <count>".
  - With an empty pile (at game start, or after a reshuffle into the draw
    pile), it shows a placeholder box and "Discard 0".
  - It re-renders after every state change, so it is always current.

## Testing

- **Content:**
  - Equipping into an empty slot moves only the played card.
  - Equipping into a filled slot first discards the old card, which ends up in
    the discard pile.
  - A weapon and an armor coexist.
  - The registry test: every equipment card has a slot, and no non-equipment
    card has one.
  - `equipSlotOf` returns the right slots, and `null` for unknown ids.
- **Bots:**
  - Doesn't equip a second weapon.
  - Equips armor while already holding a weapon.
- **Sim:**
  - The invariant reports a same-slot pair.
  - The property tests stay green (random bots will now exercise replacement).
- **App:**
  - The seat tile renders 4 boxes in order, filled and empty.
  - The round table shows the last discarded card, its caption and count, and
    the empty-pile placeholder.
- **Manual:** a browser check that equipping shows on the tile, and that the
  discard display updates as cards are played.
