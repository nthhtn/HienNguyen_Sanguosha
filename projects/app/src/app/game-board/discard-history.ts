import { CardInstance, EngineEvent } from 'engine';

export type DiscardHistoryEntry =
  | { kind: 'card'; card: CardInstance; inPile: boolean }
  | { kind: 'reshuffle'; cardCount: number };

// Every card ever discarded, read off the public log, most recent first, with a
// marker wherever the pile was shuffled back into the draw pile. Cards older
// than the latest reshuffle are no longer in the pile.
export function discardHistory(log: EngineEvent[], discardZoneId: string): DiscardHistoryEntry[] {
  const entries: DiscardHistoryEntry[] = [];
  let inPile = true;
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event.kind === 'DiscardPileReshuffledEvent') {
      entries.push({ kind: 'reshuffle', cardCount: event.cardCount });
      inPile = false;
    } else if (event.kind === 'CardMovedEvent' && event.toZoneId === discardZoneId && event.card) {
      entries.push({ kind: 'card', card: event.card, inPile });
    }
  }
  return entries;
}
