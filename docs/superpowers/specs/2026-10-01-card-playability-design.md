# Card Playability (Sha Limit and Range) and a Larger Board — Design Spec

Status: Draft for review
Date: 2026-10-01

## Purpose

1. **Basic playability rules.** Today `getLegalActions` offers every hand card
   to the turn owner, untargeted and against every other seat, any number of
   times, in any phase. This is the engine spec's deferred "card playability"
   gap (I2). This change makes each card declare its own legal plays. It adds
   the rules the user asked for:
   - at most one Sha per turn;
   - Sha only at a seat within attack range, where distance counts mounts and
     range comes from the weapon.

   It also gives every current card a correct play rule.
2. **A larger player board.** The seat tiles and the table are hard to read.
   Make them roughly twice as large.

Decisions settled with the user:
- Playability rules cover **all current cards**, not only Sha.
- Sha's per-turn limit is 1 unless an effect raises it. No such effect is in
  the deck yet.
- Attack range is 1 with no weapon, or the equipped weapon's range from card
  data otherwise.
- Distance accounts for mounts.

## Engine changes

### Card play hook

```ts
// projects/engine/src/lib/registry/types.ts
export interface PlayOptionsContext {
  seatId: string;
  cardInstanceId: string;
}

export interface CardDefinition {
  // ...unchanged...
  // Every legal target list for proactively playing this card on the owner's
  // own turn: [] means "not playable now", [[]] means "playable with no
  // target", and [[{seat-1}], [{seat-2}]] means "playable at seat-1 or seat-2".
  // Absent means the legacy behaviour (untargeted plus each living other seat),
  // kept only for test stubs.
  legalPlayTargets?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): Target[][];
}
```

### Per-turn play counts

```ts
// projects/engine/src/lib/domain/types.ts
export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
  // Proactive card plays this turn, by card definition id. Missing means none.
  cardPlays?: Record<string, number>;
}
```

### Rule text

1. **Play phase only.** A `PlayCardAction` is legal only when
   `state.phase === 'Play'`, the seat is the turn owner, and there is no
   pending response. This closes the engine spec's deferred phase-enforcement
   gap for card plays. `EndPhaseAction` stays legal in every phase of the
   owner's turn.
2. **Legal plays come from the card.** For each hand card, if its definition
   has `legalPlayTargets`, `getLegalActions` offers exactly one
   `PlayCardAction` per returned target list, in the returned order. Otherwise
   it keeps the legacy offers. `getLegalActions` needs the registry for this.
   Without one, the legacy offers apply, as for existing callers that pass
   none.
3. **Resolve validates.** `resolve` rejects a `PlayCardAction` whose target
   list isn't among the card's `legalPlayTargets`, with the message
   `Card <id> cannot be played with those targets`. It also rejects any card
   play outside the owner's Play phase, with the message
   `Cards can only be played during your Play phase`.
4. **Counting.** A successfully resolved `PlayCardAction` increments
   `turn.cardPlays[definitionId]`. `RespondAction` plays do not count: a Sha
   used to answer a Duel is not "played" for the per-turn limit. A new turn
   (from `advanceTurn`) starts with no `cardPlays` field.

## Content: each card's rule

Shared helpers go in `projects/content/src/lib/shared/queries.ts`:
- `seatDistance(state, fromSeatId, toSeatId, registry)` is the existing
  living-seat ring distance (`getSeatDistance`). The target's equipped
  `plusMount` adds +1, and the attacker's equipped `minusMount` adds −1. The
  result is never below 1. Unreachable seats stay `Infinity`.
- `attackRange(state, seatId, registry)` is the equipped weapon's
  `weaponRange`, or 1 with no weapon.
- `CardDefinition` gains `weaponRange?: number`, set for weapons from card data
  (`range`). Green Dragon Blade is 3.
- `shaLimit(state, seatId, registry)` returns 1. This is the single place a
  future effect (for example Crossbow) raises the limit.

Each card's rule:

| Card | `legalPlayTargets` |
|---|---|
| Sha | `[]` if `cardPlays['sha'] >= shaLimit`; else `[[seat]]` for each living other seat with `seatDistance <= attackRange` |
| Shan | `[]` (response only) |
| Wuxie | `[]` (response only) |
| Peach | `[[]]` if `combinedHp < maxCombinedHp`, else `[]` |
| Duel | `[[seat]]` for each living other seat (any distance) |
| Green Dragon Blade, Silver Lion | `[[]]` |

Untargeted Sha or Duel is no longer offered, so the engine-no-op branches in
their `play()` become unreachable from legal play. They stay as defensive
guards.

Zhao Yun's existing "Vanguard" skill keeps using the plain ring distance. Its
rule text predates mounts, and changing it is out of scope.

## Bots

The rule-based policy needs no change. It already picks only among legal
actions, and limits itself to one Sha. Its own `shaPlayed` memory becomes
redundant but harmless.

## UI: larger board

- **Table:** `max-width` 960px → 1280px. The aspect ratio is unchanged, so it
  is about 1.33× wider and taller on large screens.
- **Seat tile, about twice as large:**
  - font `0.8em` → `1.1em`
  - general portraits `small` (44×60) → `normal` (70×96)
  - equipment slots `tiny` (26×36) → `small` (44×60)
  - `min-width` 108px → 200px
  - padding and badges scaled to match
- **Phone width:** the existing ≤600px media query scales the tiles down
  (`scale(0.55)`), so they still fit around the table.

## Testing

- **Engine:**
  - No card plays outside the Play phase.
  - The hook's target lists become exactly the offered actions.
  - Legacy behaviour applies without a hook, or without a registry.
  - Resolve rejects an illegal target list, and a play outside the Play phase.
  - `cardPlays` counts proactive plays and not responses, and resets on a new
    turn.
- **Content:**
  - Each card's rule from the table, including:
    - Sha range at distance 1 vs 2 with no weapon
    - Sha range with Green Dragon Blade (3)
    - the second Sha blocked
    - Peach only when hurt
    - Shan and Wuxie never proactive
  - `seatDistance` with a +1 mount on the target and a −1 mount on the
    attacker, never below 1. Tested with stub mount cards, since there are no
    real mounts yet.
- **Sim and bots:** the property tests stay green with both bot kinds.
- **App:**
  - The GameBoard and hand-view tests still pass.
  - New tile size assertions: the general art uses `normal`, and the slots use
    `small`.
  - A browser check at 1280px and 400px.
