import type { WikiCard } from 'content';

const SUIT_SYMBOL: Record<WikiCard['printings'][number]['suit'], string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
};
const FACE_RANK: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// One physical copy's corner, e.g. { suit: 'spade', rank: 1 } -> "♠A".
export function printingLabel(printing: WikiCard['printings'][number]): string {
  return `${SUIT_SYMBOL[printing.suit]}${FACE_RANK[printing.rank] ?? printing.rank}`;
}
