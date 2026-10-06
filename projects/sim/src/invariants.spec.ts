import { checkInvariants, checkRestingState } from './invariants';
import type { CardInstance, GameState, PendingSelection } from 'engine';

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
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
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

  it('flags a living seat at 0 HP or below with no rescue round pending', () => {
    const state = baseState();
    state.seats[0].combinedHp = -1;
    expect(checkInvariants(state)).toEqual([expect.stringContaining('no rescue round pending')]);
  });

  it('allows a seat below 0 HP while its rescue round is asking, or once eliminated', () => {
    const dying = baseState();
    dying.seats[0].combinedHp = -1;
    dying.pendingResponse = {
      id: 'd1', respondingSeatId: dying.seats[0].id, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
      reason: { kind: 'dying', seatId: dying.seats[0].id },
      context: { effect: { kind: 'DyingEffect', seatId: dying.seats[0].id, order: [], rescueCardIds: { any: ['peach'], self: [] } } },
    };
    expect(checkInvariants(dying)).toEqual([]);
    const out = baseState();
    out.seats[0].combinedHp = -1;
    out.seats[0].eliminated = true;
    expect(checkInvariants(out).filter((v) => v.includes('HP'))).toEqual([]);
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
  it('flags a judgment area holding two of the same delayed Tool', () => {
    const delayed = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });
    const state = baseState({
      zones: [{ id: 'seat-a:judgment', kind: 'judgment', ownerSeatId: 'seat-a', cards: [delayed('c1', 'capture'), delayed('l1', 'lightning'), delayed('c2', 'capture')] }],
    });
    expect(checkInvariants(state)).toEqual(['Judgment zone seat-a:judgment holds two capture cards']);
  });
  it('flags an eliminated seat still holding cards while the game runs', () => {
    const base = baseState();
    const out = { ...base.seats[0], eliminated: true };
    const state = baseState({ seats: [out], zones: [{ id: 'seat-a:judgment', kind: 'judgment', ownerSeatId: 'seat-a', cards: [card('c1')] }] });
    expect(checkInvariants(state)).toContain('Eliminated seat seat-a still holds 1 card(s) in seat-a:judgment');
    expect(checkInvariants({ ...state, result: { endedAt: 1, winningSeatIds: [], losingSeatIds: ['seat-a'] } })).not.toContain(
      'Eliminated seat seat-a still holds 1 card(s) in seat-a:judgment'
    );
  });
});

describe('general-selection invariants', () => {
  const secondSeat = (generals: GameState['seats'][number]['generals']): GameState['seats'][number] => ({
    id: 'seat-b', index: 1, kingdom: 'Wei', generals,
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' }, eliminated: false,
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

describe('checkRestingState', () => {
  function restingState(phase: GameState['phase'], handSize = 0, combinedHp = 4): GameState {
    const base = baseState();
    return {
      ...base,
      seats: [{ ...base.seats[0], combinedHp, maxCombinedHp: 4 }],
      turn: { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] },
      phase,
      zones: [{
        id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a',
        cards: Array.from({ length: handSize }, (_, i) => card(`c${i}`)),
      }],
    };
  }

  it('accepts Play, an over-limit Discard, and general selection', () => {
    expect(checkRestingState(restingState('Play'))).toEqual([]);
    expect(checkRestingState(restingState('Discard', 6, 4))).toEqual([]);
    expect(checkRestingState(restingState('GeneralSelection'))).toEqual([]);
  });

  it('flags a game resting in a phase with no decision to make', () => {
    expect(checkRestingState(restingState('Draw'))).toEqual([
      "Game is resting in seat-a's Draw phase (turn 3) with no decision to make",
    ]);
    expect(checkRestingState(restingState('Discard', 2, 4))).toHaveLength(1);
  });

  it('accepts any phase once the game has ended', () => {
    expect(checkRestingState({ ...restingState('Draw'), result: { endedAt: 3, winningSeatIds: [], losingSeatIds: [] } })).toEqual([]);
  });
});

describe('checkRestingState: the resolution queue', () => {
  it('flags a game resting with items still queued and no decision pending', () => {
    const resting = { ...baseState(), phase: 'Play' as const, resolutionQueue: [{ kind: 'SkipNextEffect' as const }] };
    expect(checkRestingState(resting)).toEqual([expect.stringMatching(/1 item\(s\) still queued/)]);
  });

  it('allows queued items while a response is pending', () => {
    const paused = {
      ...baseState(),
      resolutionQueue: [{ kind: 'SkipNextEffect' as const }],
      pendingResponse: { id: 'r', respondingSeatId: baseState().seats[0].id, allowedActionKinds: ['PassAction'], context: { effect: { kind: 'SkipNextEffect' as const } } },
    };
    expect(checkRestingState(paused)).toEqual([]);
  });
});

describe('a pending choice', () => {
  const choiceFor = (seatId: string) => ({
    id: 'c', seatId, verb: 'take' as const, options: [],
    reason: { kind: 'choice' as const, card: { as: 'steal', colour: 'black' as const, physical: [] }, userSeatId: seatId },
  });

  it('counts as a decision, so a game may rest with items queued behind it', () => {
    const s = baseState();
    expect(checkRestingState({ ...s, resolutionQueue: [{ kind: 'SkipNextEffect' }], pendingChoice: choiceFor(s.seats[0].id) })).toEqual([]);
  });

  it('flags a pending choice for an eliminated seat', () => {
    const s = baseState();
    const out = { ...s, seats: s.seats.map((x) => ({ ...x, eliminated: true })), pendingChoice: choiceFor(s.seats[0].id) };
    expect(checkInvariants(out)).toContain(`pendingChoice references eliminated seat ${s.seats[0].id}`);
  });
});
describe('a pending selection', () => {
  const selectionFor = (seatId: string): PendingSelection => ({
    id: 's', seatId, of: 'cards', eligibleIds: [], min: 1, max: 1, then: { kind: 'discard' },
    reason: { kind: 'ability', owner: { kind: 'equipment', seatId, cardInstanceId: 'x' }, abilityId: 'x' },
  });

  it('counts as a decision, so a game may rest with items queued behind it', () => {
    const s = baseState();
    expect(checkRestingState({ ...s, resolutionQueue: [{ kind: 'SkipNextEffect' }], pendingSelection: selectionFor(s.seats[0].id) })).toEqual([]);
  });

  it('flags a pending selection for an eliminated seat', () => {
    const s = baseState();
    const out = { ...s, seats: s.seats.map((x) => ({ ...x, eliminated: true })), pendingSelection: selectionFor(s.seats[0].id) };
    expect(checkInvariants(out)).toContain(`pendingSelection references eliminated seat ${s.seats[0].id}`);
  });
});
