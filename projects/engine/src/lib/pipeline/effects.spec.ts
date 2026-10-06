import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState } from '../domain/types';

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'heart', rank: 9 });

function state(drawPile: CardInstance[], discardPile: CardInstance[], hand: CardInstance[] = []): GameState {
  return {
    seats: [{
      id: 'seat-a', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: drawPile },
      { id: 'discardPile', kind: 'discardPile', cards: discardPile },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: hand },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('MoveCardEffect', () => {
  it('says which card landed face-up in the discard pile', () => {
    const { events } = applyEffect(state([], [], [card('h1')]), { kind: 'MoveCardEffect', cardInstanceId: 'h1', toZoneId: 'discardPile' });
    expect(events).toEqual([{ kind: 'CardMovedEvent', cardInstanceId: 'h1', fromZoneId: 'seat-a:hand', toZoneId: 'discardPile', card: card('h1') }]);
  });

  it('never says which card went into a hand: the log is public', () => {
    const { events } = applyEffect(state([], [card('d1')]), { kind: 'MoveCardEffect', cardInstanceId: 'd1', toZoneId: 'seat-a:hand' });
    expect(events).toEqual([{ kind: 'CardMovedEvent', cardInstanceId: 'd1', fromZoneId: 'discardPile', toZoneId: 'seat-a:hand' }]);
  });
});

describe('DrawCardsEffect', () => {
  it('logs the reshuffle of the discard pile before the draw that needed it', () => {
    const { state: next, events } = applyEffect(state([card('c1')], [card('d1'), card('d2')]), { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 2 });
    expect(events.map((e) => e.kind)).toEqual(['DiscardPileReshuffledEvent', 'CardsDrawnEvent']);
    expect(events[0]).toEqual({ kind: 'DiscardPileReshuffledEvent', cardCount: 2 });
    expect(next.log).toEqual(events);
  });

  it('logs no reshuffle when the draw pile is enough', () => {
    const { events } = applyEffect(state([card('c1'), card('c2')], [card('d1')]), { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 2 });
    expect(events.map((e) => e.kind)).toEqual(['CardsDrawnEvent']);
  });
});


describe('the processing zone', () => {
  const withProcessing = (s: GameState): GameState => ({ ...s, zones: [...s.zones, { id: 'processing', kind: 'processing', cards: [] }] });

  it('RevealToProcessingEffect turns cards up from the draw pile, face up for all to see', () => {
    const { state: next, events } = applyEffect(withProcessing(state([card('c1'), card('c2'), card('c3')], [])), { kind: 'RevealToProcessingEffect', count: 2 });
    expect(next.zones.find((z) => z.id === 'processing')!.cards).toEqual([card('c1'), card('c2')]);
    expect(events).toEqual([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [card('c1'), card('c2')] }]);
  });

  it('DiscardZoneEffect moves every card in the zone to the discard pile, in order', () => {
    const turnedUp = applyEffect(withProcessing(state([card('c1'), card('c2')], [])), { kind: 'RevealToProcessingEffect', count: 2 }).state;
    const { state: next, events } = applyEffect(turnedUp, { kind: 'DiscardZoneEffect', zoneId: 'processing' });
    expect(next.zones.find((z) => z.id === 'processing')!.cards).toEqual([]);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards).toEqual([card('c1'), card('c2')]);
    expect(events.map((e) => e.kind)).toEqual(['CardMovedEvent', 'CardMovedEvent']);
  });
});
