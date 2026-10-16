import { isSeatDying } from './dying';
import { CardInstance, GameState } from '../domain/types';
import { createRng } from '../rng/rng';

const card: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 };

function state(opts: { hp?: number; eliminated?: boolean; pile?: CardInstance[]; stash?: CardInstance[]; rescuing?: boolean } = {}): GameState {
  const { hp = 0, eliminated = false, pile = [], stash = [], rescuing = false } = opts;
  return {
    seats: [{
      id: 'seat-a', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp: hp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' },
      pile: { zoneId: 'seat-a:pile' }, stash: { zoneId: 'seat-a:stash' }, eliminated,
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'play',
    zones: [
      { id: 'seat-a:pile', kind: 'pile', ownerSeatId: 'seat-a', cards: pile },
      { id: 'seat-a:stash', kind: 'pile', ownerSeatId: 'seat-a', cards: stash },
    ],
    pendingResponse: rescuing ? ({ reason: { kind: 'dying', seatId: 'seat-a' } } as unknown as GameState['pendingResponse']) : null,
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('isSeatDying', () => {
  it('is false above 0 HP', () => {
    expect(isSeatDying(state({ hp: 1 }), 'seat-a')).toBe(false);
  });
  it('is false for an eliminated seat', () => {
    expect(isSeatDying(state({ eliminated: true }), 'seat-a')).toBe(false);
  });
  it('is false for a missing seat', () => {
    expect(isSeatDying(state(), 'seat-z')).toBe(false);
  });
  it('is true at 0 HP with no pile', () => {
    expect(isSeatDying(state(), 'seat-a')).toBe(true);
  });
  it('is false at 0 HP while a card lies in its pile', () => {
    expect(isSeatDying(state({ pile: [card] }), 'seat-a')).toBe(false);
  });
  it('is true at 0 HP while its rescue window is pending, even with a card in the pile', () => {
    expect(isSeatDying(state({ pile: [card], rescuing: true }), 'seat-a')).toBe(true);
  });
  it('ignores the stash', () => {
    expect(isSeatDying(state({ stash: [card] }), 'seat-a')).toBe(true);
  });
});
