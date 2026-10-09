import { resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { createRng } from '../rng/rng';
import { GameState, Phase } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};
const ctx = { registry, mode };

// seat-a owns the turn with HP 1 and three cards in hand: two over the limit.
function state(phase: Phase = 'Discard', combinedHp = 1): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: ['h1', 'h2', 'h3'].map((instanceId) => ({ instanceId, definitionId: 'sha', suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const discard = (cardInstanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId });
const zone = (s: GameState, id: string) => s.zones.find((z) => z.id === id)!.cards.map((c) => c.instanceId);

describe('DiscardCardAction', () => {
  it('offers one discard per hand card, and nothing else, while over the hand limit (Review Focus 2)', () => {
    expect(getLegalActions(state(), 'seat-a', registry)).toEqual([discard('h1'), discard('h2'), discard('h3')]);
    expect(getLegalActions(state('Discard', 0), 'seat-a', registry)).toHaveLength(3);
    expect(getLegalActions(state(), 'seat-b', registry)).toEqual([]);
  });

  it('moves the chosen card to the discard pile and logs a CardMovedEvent with the card’s face', () => {
    const { state: next, events } = resolve(state(), discard('h2'), ctx);
    expect(zone(next, 'seat-a:hand')).toEqual(['h1', 'h3']);
    expect(zone(next, 'discardPile')).toEqual(['h2']);
    expect(events[0]).toEqual({
      kind: 'CardMovedEvent', cardInstanceId: 'h2', fromZoneId: 'seat-a:hand', toZoneId: 'discardPile',
      card: { instanceId: 'h2', definitionId: 'sha', suit: 'spade', rank: 1 },
    });
  });

  it('stops offering discards once the hand is down to the limit', () => {
    const once = resolve(state(), discard('h1'), ctx).state;
    const twice = resolve(once, discard('h2'), ctx).state;
    expect(zone(twice, 'seat-a:hand')).toEqual(['h3']);
    expect(getLegalActions(twice, 'seat-a', registry).some((a) => a.kind === 'DiscardCardAction')).toBe(false);
  });

  it('rejects a discard outside the Discard phase', () => {
    expect(() => resolve(state('Play'), discard('h1'), ctx)).toThrow('Cards can only be discarded during your Discard phase');
  });

  it('rejects a discard when the seat is within its hand limit', () => {
    expect(() => resolve(state('Discard', 3), discard('h1'), ctx)).toThrow('is within its hand limit');
  });

  it('rejects discarding a card the seat does not hold', () => {
    expect(() => resolve(state(), discard('nope'), ctx)).toThrow('Seat seat-a does not hold card nope');
  });

  it('rejects a discard from a seat that does not own the turn', () => {
    expect(() =>
      resolve(state(), { kind: 'DiscardCardAction', seatId: 'seat-b', cardInstanceId: 'h1' }, ctx)
    ).toThrow('Cards can only be discarded during your Discard phase');
  });
});
