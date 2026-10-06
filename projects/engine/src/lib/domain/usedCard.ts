import { CardInstance, UsedCard } from './types';

export function colourOf(card: Pick<CardInstance, 'suit'>): 'red' | 'black' {
  return card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';
}

// One physical card used as itself.
export function usedCardOf(card: CardInstance): UsedCard {
  return { as: card.definitionId, colour: colourOf(card), suit: card.suit, rank: card.rank, physical: [card] };
}

// Cards used together as one `as` card (Serpent Spear's 2 hand cards as a Sha):
// red if all are red, black if all are black, otherwise no colour. A single
// card keeps its suit and rank; two or more have none.
export function usedCardFrom(cards: CardInstance[], as: string, via?: UsedCard['via']): UsedCard {
  const colours = new Set(cards.map(colourOf));
  return {
    as,
    colour: colours.size === 1 ? [...colours][0] : 'none',
    ...(cards.length === 1 ? { suit: cards[0].suit, rank: cards[0].rank } : {}),
    physical: cards,
    ...(via ? { via } : {}),
  };
}

// A used card's identity for ids: its physical cards' instance ids, or
// 'virtual' for a card with none.
export function usedCardKey(card: UsedCard): string {
  return card.physical.map((c) => c.instanceId).join('+') || 'virtual';
}
