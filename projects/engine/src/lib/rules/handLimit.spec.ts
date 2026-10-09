import { handLimit, cardsOverHandLimit } from './handLimit';
import { phaseWaitsForPlayer } from './phaseSequence';
import { CardInstance, GameState, Phase } from '../domain/types';
import { createRng } from '../rng/rng';

function cards(n: number): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 }));
}

function state(phase: Phase, handSize: number, combinedHp: number): GameState {
  return {
    seats: [{
      id: 'seat-a', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [{ id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: cards(handSize) }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('hand limit', () => {
  it('equals the seat\'s current HP', () => {
    expect(handLimit(state('Discard', 0, 3), 'seat-a')).toBe(3);
  });

  it('has a limit of 0 at 0 HP (Review Focus 2)', () => {
    expect(handLimit(state('Discard', 2, 0), 'seat-a')).toBe(0);
    expect(cardsOverHandLimit(state('Discard', 2, 0), 'seat-a')).toBe(2);
  });

  it('counts how many cards are over the limit, never below 0', () => {
    expect(cardsOverHandLimit(state('Discard', 6, 4), 'seat-a')).toBe(2);
    expect(cardsOverHandLimit(state('Discard', 4, 4), 'seat-a')).toBe(0);
    expect(cardsOverHandLimit(state('Discard', 1, 4), 'seat-a')).toBe(0);
  });

  it('throws for an unknown seat', () => {
    expect(() => handLimit(state('Discard', 0, 3), 'nobody')).toThrow('Unknown seat: nobody');
  });
});

describe('phaseWaitsForPlayer', () => {
  it('always waits in Play', () => {
    expect(phaseWaitsForPlayer(state('Play', 0, 4))).toBe(true);
  });

  it('waits in Discard only while the owner is over the hand limit', () => {
    expect(phaseWaitsForPlayer(state('Discard', 5, 4))).toBe(true);
    expect(phaseWaitsForPlayer(state('Discard', 4, 4))).toBe(false);
  });

  it('never waits in Start, Judgment, Draw or End', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'End'] as const) {
      expect(phaseWaitsForPlayer(state(phase, 9, 1))).toBe(false);
    }
  });
});
