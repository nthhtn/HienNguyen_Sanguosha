import { CardInstance, UsedCard } from './types';

// One physical card used as itself.
export function usedCardOf(card: CardInstance): UsedCard {
  return {
    as: card.definitionId,
    colour: card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black',
    suit: card.suit,
    rank: card.rank,
    physical: [card],
  };
}
