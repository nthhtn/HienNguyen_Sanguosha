import { CardInstance, EngineEvent } from 'engine';
import { discardHistory } from './discard-history';

const card = (instanceId: string, definitionId = 'sha'): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });
const discarded = (c: CardInstance): EngineEvent => ({ kind: 'CardMovedEvent', cardInstanceId: c.instanceId, fromZoneId: 'seat-0:hand', toZoneId: 'discardPile', card: c });

describe('discardHistory', () => {
  it('lists discarded cards most recent first', () => {
    const log: EngineEvent[] = [discarded(card('a')), { kind: 'PhaseChangedEvent', seatId: 's', phase: 'Play' }, discarded(card('b'))];
    expect(discardHistory(log, 'discardPile')).toEqual([
      { kind: 'card', card: card('b'), inPile: true },
      { kind: 'card', card: card('a'), inPile: true },
    ]);
  });

  it('ignores moves into other zones', () => {
    const log: EngineEvent[] = [
      { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-0:hand', toZoneId: 'seat-0:equip', card: card('x') },
      { kind: 'CardMovedEvent', cardInstanceId: 'y', fromZoneId: 'drawPile', toZoneId: 'seat-0:hand' },
    ];
    expect(discardHistory(log, 'discardPile')).toEqual([]);
  });

  it('marks reshuffles, and the cards before them as no longer in the pile', () => {
    const log: EngineEvent[] = [
      discarded(card('a')),
      { kind: 'DiscardPileReshuffledEvent', cardCount: 1 },
      { kind: 'CardsDrawnEvent', seatId: 's', cardInstanceIds: ['a'] },
      discarded(card('a')),
      discarded(card('b')),
    ];
    expect(discardHistory(log, 'discardPile')).toEqual([
      { kind: 'card', card: card('b'), inPile: true },
      { kind: 'card', card: card('a'), inPile: true },
      { kind: 'reshuffle', cardCount: 1 },
      { kind: 'card', card: card('a'), inPile: false },
    ]);
  });
});
