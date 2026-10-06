import { seatToAct, pickRandomAction } from './random';
import { createRng } from 'engine';
import type { GameState, Effect } from 'engine';

const deferredEffect: Effect = { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 };
const emptyRegistry = { cards: new Map(), generals: new Map() };

function state(pendingResponse: GameState['pendingResponse'] = null): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' }, eliminated: false,
      },
    ],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('seatToAct', () => {
  it('is the turn owner when no response is pending', () => {
    expect(seatToAct(state())).toBe('seat-a');
  });

  it('is the responding seat when a response is pending', () => {
    const withPending = state({
      id: 'resp-1',
      respondingSeatId: 'seat-b',
      allowedActionKinds: ['PassAction'],
      context: { effect: deferredEffect },
    });
    expect(seatToAct(withPending)).toBe('seat-b');
  });

  it('is null when the turn owner has been eliminated', () => {
    const base = state();
    const withEliminatedOwner: GameState = {
      ...base,
      seats: base.seats.map((s) => (s.id === 'seat-a' ? { ...s, eliminated: true } : s)),
    };
    expect(seatToAct(withEliminatedOwner)).toBeNull();
  });

  it('is null when the pending responder has been eliminated', () => {
    const base = state({
      id: 'resp-1',
      respondingSeatId: 'seat-b',
      allowedActionKinds: ['PassAction'],
      context: { effect: deferredEffect },
    });
    const withEliminatedResponder: GameState = {
      ...base,
      seats: base.seats.map((s) => (s.id === 'seat-b' ? { ...s, eliminated: true } : s)),
    };
    expect(seatToAct(withEliminatedResponder)).toBeNull();
  });
});

describe('pickRandomAction', () => {
  it('picks a legal action for the acting seat (EndPhaseAction is always legal on its turn)', () => {
    const { action } = pickRandomAction(state(), createRng(5), emptyRegistry);
    expect(action.seatId).toBe('seat-a');
  });

  it('is deterministic for a given seed', () => {
    const first = pickRandomAction(state(), createRng(5), emptyRegistry);
    const second = pickRandomAction(state(), createRng(5), emptyRegistry);
    expect(first.action).toEqual(second.action);
  });

  it('throws a descriptive error rather than acting for an eliminated turn owner', () => {
    const base = state();
    const withEliminatedOwner: GameState = {
      ...base,
      seats: base.seats.map((s) => (s.id === 'seat-a' ? { ...s, eliminated: true } : s)),
    };
    expect(() => pickRandomAction(withEliminatedOwner, createRng(5), emptyRegistry)).toThrow(/No seat is able to act/);
  });
});
