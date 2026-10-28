import { resolve } from './resolve';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';
import { CardMovedEvent } from './events';

// A mode whose only trigger draws 1 whenever a hand is left empty (a Linked Camps stand-in).
const refill: GameModeDefinition = {
  id: 'refill', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null,
  triggers: [{
    point: 'after:CardMovedEvent',
    condition: (state, subject) => (subject as CardMovedEvent).fromZoneId === 'a:hand' && state.zones.find((z) => z.id === 'a:hand')!.cards.length === 0,
    effect: () => [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }],
  }],
};
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const card = (instanceId: string) => ({ instanceId, definitionId: 'x', suit: 'spade' as const, rank: 1 });

// a holds 2 cards at 0 HP (hand limit 0): its Play Phase is ending.
function table(): GameState {
  return {
    seats: [{ id: 'a', index: 0, kingdom: 'Wei', eliminated: false, generals: null, combinedHp: 0, maxCombinedHp: 4, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' } }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: Array.from({ length: 10 }, (_, i) => card(`d${i}`)) },
      { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('h1'), card('h2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('the Discard Phase owes what was over the limit as it began', () => {
  it('a card drawn mid-phase (after the last one goes) is not owed too', () => {
    const ctx = { registry, mode: refill };
    let s = resolve(table(), { kind: 'EndPhaseAction', seatId: 'a' }, ctx).state;
    expect(s.phase).toBe('Discard');
    s = resolve(s, { kind: 'DiscardCardAction', seatId: 'a', cardInstanceId: 'h1' }, ctx).state;
    s = resolve(s, { kind: 'DiscardCardAction', seatId: 'a', cardInstanceId: 'h2' }, ctx).state;
    // The refill drew d0; the phase still ends: 2 were owed, 2 discarded.
    expect(s.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId)).toEqual(['d0']);
    expect(s.phase).not.toBe('Discard');
  });
});
