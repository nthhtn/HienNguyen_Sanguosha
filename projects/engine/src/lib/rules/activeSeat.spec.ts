import { getActingSeatIds, getActiveSeatId } from './activeSeat';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    generalSelection: null,
    ...overrides,
  };
}

describe('getActiveSeatId', () => {
  it('is the turn owner when no response is pending', () => {
    expect(getActiveSeatId(state())).toBe('seat-a');
  });

  it('is the responder when a response is pending', () => {
    const pending = {
      id: 'r1', respondingSeatId: 'seat-b', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 1 } },
    };
    expect(getActiveSeatId(state({ pendingResponse: pending }))).toBe('seat-b');
  });

  it('is null when the would-be actor is eliminated', () => {
    expect(getActiveSeatId(state({ seats: [seat('seat-a', 0, true), seat('seat-b', 1)] }))).toBeNull();
  });

  it('is null once the game has a result', () => {
    expect(getActiveSeatId(state({ result: { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] } }))).toBeNull();
  });

  it('is the first seat, in seat order, still holding candidates during GeneralSelection', () => {
    const selecting = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'], 'seat-a': ['y'] } } });
    expect(getActiveSeatId(selecting)).toBe('seat-a');
    const afterA = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'] } } });
    expect(getActiveSeatId(afterA)).toBe('seat-b');
  });
});

describe('getActingSeatIds', () => {
  const selecting = (candidates: Record<string, string[]>) => state({ phase: 'GeneralSelection', generalSelection: { candidates } });

  it('lists every seat that still has candidates during GeneralSelection, in seat order', () => {
    expect(getActingSeatIds(selecting({ 'seat-b': ['x'], 'seat-a': ['y'] }))).toEqual(['seat-a', 'seat-b']);
  });

  it('no longer lists a seat once it has chosen', () => {
    expect(getActingSeatIds(selecting({ 'seat-b': ['x'] }))).toEqual(['seat-b']);
  });

  it('is the active seat alone outside GeneralSelection', () => {
    expect(getActingSeatIds(state())).toEqual(['seat-a']);
  });

  it('is empty when nobody can act', () => {
    expect(getActingSeatIds(state({ result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] } }))).toEqual([]);
  });

  it('leaves getActiveSeatId on the first seat with candidates', () => {
    expect(getActiveSeatId(selecting({ 'seat-b': ['x'], 'seat-a': ['y'] }))).toBe('seat-a');
  });
});

describe('getActiveSeatId with a settled judgment', () => {
  const player = (seatId: string, kind: 'human' | 'bot') => ({ id: `p-${seatId}`, seatId, kind, name: seatId });
  const view = (seatId = 'seat-a', settled = true): GameState['judgmentView'] => ({ seatId, reader: { kind: 'card', card: {} as never }, card: { instanceId: 'j', definitionId: 'x', suit: 'club', rank: 3 }, changes: [], settled, rounds: 0 });
  const three = (over: Partial<GameState> = {}) => state({ seats: [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)], ...over });

  it('is the first living human', () => {
    const s = three({ judgmentView: view(), players: [player('seat-a', 'bot'), player('seat-b', 'human'), player('seat-c', 'human')] });
    expect(getActiveSeatId(s)).toBe('seat-b');
  });

  it('falls back to the judged seat when there is no human', () => {
    const s = three({ judgmentView: view('seat-c'), players: [player('seat-a', 'bot'), player('seat-b', 'bot'), player('seat-c', 'bot')] });
    expect(getActiveSeatId(s)).toBe('seat-c');
  });

  it('falls back to the first living seat when the judged seat and every human are eliminated', () => {
    const s = three({
      seats: [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2, true)],
      judgmentView: view('seat-c'),
      players: [player('seat-a', 'bot'), player('seat-b', 'human'), player('seat-c', 'bot')],
    });
    expect(getActiveSeatId(s)).toBe('seat-a');
  });

  it('an unsettled view changes nothing', () => {
    expect(getActiveSeatId(three({ judgmentView: view('seat-c', false), players: [player('seat-b', 'human')] }))).toBe('seat-a');
  });
});
