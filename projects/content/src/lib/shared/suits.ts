import type { CardInstance, ContentRegistry, GameState } from 'engine';
import { activeAbilities } from './abilities';

// The suit `card` counts as for `seatId` (its own card or its judgment): a
// suit modifier of the seat may change it (Beauty). Every rule that reads the
// suit of a seat's own card or judgment reads it here.
export function suitOf(state: GameState, seatId: string, card: CardInstance, registry: ContentRegistry): CardInstance['suit'] {
  for (const abilities of activeAbilities(state, seatId, registry)) {
    const as = abilities.modifiers?.suitAs?.[card.suit];
    if (as) return as;
  }
  return card.suit;
}

// Its colour, by that suit.
export function colourFor(state: GameState, seatId: string, card: CardInstance, registry: ContentRegistry): 'red' | 'black' {
  const suit = suitOf(state, seatId, card, registry);
  return suit === 'heart' || suit === 'diamond' ? 'red' : 'black';
}
