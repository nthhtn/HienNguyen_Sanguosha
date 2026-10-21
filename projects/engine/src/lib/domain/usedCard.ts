import { CardInstance, UsedCard } from './types';
import type { ContentRegistry } from '../registry/types';

export function colourOf(card: Pick<CardInstance, 'suit'>): 'red' | 'black' {
  return card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';
}

// One physical card used as itself. With the registry, a card that plays as
// another (CardDefinition.playsAs) is used as that one, with its nature.
export function usedCardOf(card: CardInstance, registry?: ContentRegistry): UsedCard {
  const definition = registry?.cards.get(card.definitionId);
  return {
    as: definition?.playsAs ?? card.definitionId,
    colour: colourOf(card),
    suit: card.suit,
    rank: card.rank,
    physical: [card],
    ...(definition?.nature ? { nature: definition.nature } : {}),
  };
}

// Whether a physical card of `definitionId` answers as one of `cardIds`: it is
// one of them, or plays as one (CardDefinition.playsAs).
export function answersAs(definitionId: string, cardIds: readonly string[], registry?: ContentRegistry): boolean {
  if (cardIds.includes(definitionId)) return true;
  const playsAs = registry?.cards.get(definitionId)?.playsAs;
  return playsAs !== undefined && cardIds.includes(playsAs);
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

// One use of a Tool, for Kingdom cancels (GameState.toolCancellations): what
// it is used as and its first physical card ('virtual' for none).
export function toolKeyOf(tool: UsedCard): string {
  return `${tool.as}-${tool.physical[0]?.instanceId ?? 'virtual'}`;
}
