import { checkInvariants } from './invariants';
import type { CardInstance, GameState } from 'engine';

function card(instanceId: string): CardInstance {
  return { instanceId, definitionId: 'sha', suit: 'spade', rank: 1 };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
    ],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [], pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...overrides,
  };
}

describe('checkInvariants', () => {
  it('reports no violations for a clean state', () => {
    expect(checkInvariants(baseState())).toEqual([]);
  });

  it('flags negative combinedHp', () => {
    const state = baseState();
    state.seats[0].combinedHp = -1;
    expect(checkInvariants(state)).toEqual([expect.stringContaining('negative combinedHp')]);
  });

  it('flags a pendingResponse pointing at an eliminated seat', () => {
    const state = baseState();
    state.seats[0].eliminated = true;
    state.pendingResponse = {
      id: 'r1',
      respondingSeatId: 'seat-a',
      allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 } },
    };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('eliminated seat')]);
  });

  it('flags a GameResult that references an unknown seat', () => {
    const state = baseState({ result: { endedAt: 1, winningSeatIds: ['ghost-seat'], losingSeatIds: [] } });
    expect(checkInvariants(state)).toEqual([expect.stringContaining('unknown seat')]);
  });
});

describe('general-selection invariants', () => {
  const secondSeat = (generals: GameState['seats'][number]['generals']): GameState['seats'][number] => ({
    id: 'seat-b', index: 1, kingdom: 'Wei', generals,
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
  });

  it('flags a seat with no generals after selection has ended', () => {
    const state = baseState();
    state.seats[0] = { ...state.seats[0], generals: null };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('has no generals after general selection')]);
  });

  it('does not flag unchosen seats during GeneralSelection', () => {
    const state = baseState({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['g1'] } } });
    state.seats[0] = { ...state.seats[0], generals: null };
    expect(checkInvariants(state)).toEqual([]);
  });

  it('flags a leftover generalSelection after the phase has ended', () => {
    expect(checkInvariants(baseState({ generalSelection: { candidates: {} } }))).toEqual([
      expect.stringContaining('generalSelection is still set'),
    ]);
  });

  it('flags a general held by two seats', () => {
    const base = baseState();
    const state = { ...base, seats: [...base.seats, secondSeat(base.seats[0].generals)] };
    expect(checkInvariants(state)).toEqual(expect.arrayContaining([expect.stringContaining('is held by both')]));
  });

  it('flags a seat whose generals do not match its kingdom, when given the registry', () => {
    const registry = {
      cards: new Map(),
      generals: new Map([
        ['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
        ['g2', { id: 'g2', kingdom: 'Shu' as const, maxHp: 4, skills: [] }],
      ]),
    };
    expect(checkInvariants(baseState(), registry)).toEqual([expect.stringContaining('g2')]);
  });
});

describe('checkInvariants: card conservation', () => {
  it('reports no violations when every card instance appears exactly once', () => {
    const state = baseState({
      zones: [
        { id: 'drawPile', kind: 'drawPile', cards: [card('c1'), card('c2')] },
        { id: 'discardPile', kind: 'discardPile', cards: [card('c3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [card('c4')] },
      ],
    });
    expect(checkInvariants(state)).toEqual([]);
  });

  it('flags a card instance present in two zones at once, naming the duplicate', () => {
    const state = baseState({
      zones: [
        { id: 'drawPile', kind: 'drawPile', cards: [card('c1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [card('c1')] },
      ],
    });
    const violations = checkInvariants(state);
    expect(violations).toEqual([expect.stringContaining('c1')]);
    expect(violations[0]).toContain('more than one zone');
    expect(violations[0]).toContain('drawPile');
    expect(violations[0]).toContain('seat-a:hand');
  });

  it('flags a card instance duplicated inside a single zone, naming the duplicate', () => {
    const state = baseState({
      zones: [{ id: 'discardPile', kind: 'discardPile', cards: [card('c7'), card('c7')] }],
    });
    const violations = checkInvariants(state);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('c7');
    expect(violations[0]).toContain('discardPile');
  });
});

describe('equipment slot invariant', () => {
  const registry = {
    generals: new Map([
      ['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
      ['g2', { id: 'g2', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
    ]),
    cards: new Map([
      ['blade', { id: 'blade', name: 'Blade', category: 'equipment' as const, equipSlot: 'weapon' as const, play: () => [] }],
      ['lion', { id: 'lion', name: 'Lion', category: 'equipment' as const, equipSlot: 'armor' as const, play: () => [] }],
    ]),
  };
  const equipZone = (ids: string[]) => ({
    id: 'seat-a:equip', kind: 'equip' as const, ownerSeatId: 'seat-a',
    cards: ids.map((d, i) => ({ instanceId: `${d}-${i}`, definitionId: d, suit: 'spade' as const, rank: 1 })),
  });

  it('flags two cards in the same slot', () => {
    expect(checkInvariants(baseState({ zones: [equipZone(['blade', 'blade'])] }), registry)).toEqual([
      expect.stringContaining('two weapon cards'),
    ]);
  });

  it('accepts one card in each of two slots', () => {
    expect(checkInvariants(baseState({ zones: [equipZone(['blade', 'lion'])] }), registry)).toEqual([]);
  });
});
