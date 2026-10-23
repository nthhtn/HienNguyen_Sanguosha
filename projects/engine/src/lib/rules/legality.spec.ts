import { fitsPick, getLegalActions, hiddenSlots, getLegalTargets, pickAllows, targetsAllowed } from './legality';
import { GameState, Target } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { createRng } from '../rng/rng';

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' }, eliminated: false,
      },
      {
        id: 'seat-c', index: 2, kingdom: 'Wu',
        generals: { main: { generalDefinitionId: 'g5', revealed: false }, deputy: { generalDefinitionId: 'g6', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-c:hand' }, equipped: { zoneId: 'seat-c:equip' }, judgment: { zoneId: 'seat-c:judgment' }, eliminated: true,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'c2', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-c:hand', kind: 'hand', ownerSeatId: 'seat-c', cards: [] },
      { id: 'seat-c:equip', kind: 'equip', ownerSeatId: 'seat-c', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null, generalSelection: null,
    ...overrides,
  };
}

describe('getLegalTargets', () => {
  it('excludes the acting seat and eliminated seats', () => {
    expect(getLegalTargets(state(), 'seat-a')).toEqual([{ kind: 'seat', seatId: 'seat-b' }]);
  });
});

describe('getLegalActions', () => {
  it('returns no actions once the game has a result', () => {
    expect(getLegalActions(state({ result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] } }), 'seat-a')).toEqual([]);
  });

  it('during a pending response, only the responding seat gets Pass + whitelisted Respond actions', () => {
    const withPending = state({
      pendingResponse: {
        id: 'resp-1', respondingSeatId: 'seat-b',
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: ['shan'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 } },
      },
    });
    expect(getLegalActions(withPending, 'seat-a')).toEqual([]);
    const actionsForB = getLegalActions(withPending, 'seat-b');
    expect(actionsForB).toContainEqual({ kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'resp-1' });
    expect(actionsForB).toContainEqual({
      kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-1', cardInstanceId: 'c2',
    });
    expect(actionsForB).toHaveLength(2);
  });

  it('outside a pending response, only the active seat gets EndPhaseAction and PlayCardAction variants', () => {
    const actionsForA = getLegalActions(state(), 'seat-a');
    expect(actionsForA).toContainEqual({ kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(actionsForA).toContainEqual({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [] });
    expect(actionsForA).toContainEqual({
      kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }],
    });
    expect(getLegalActions(state(), 'seat-b')).toEqual([]);
  });

  it('returns no actions for an eliminated seat, even when it is the named turn owner', () => {
    const withEliminatedOwner = state({
      turn: { turnNumber: 1, ownerSeatId: 'seat-c', extraTurnStack: [] }, // seat-c is eliminated
    });
    expect(getLegalActions(withEliminatedOwner, 'seat-c')).toEqual([]);
  });

  it('returns no actions for an eliminated seat, even when it is the named pending responder', () => {
    const withEliminatedResponder = state({
      pendingResponse: {
        id: 'resp-1',
        respondingSeatId: 'seat-c', // seat-c is eliminated
        allowedActionKinds: ['RespondAction', 'PassAction'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-c' }, amount: 1 } },
      },
    });
    expect(getLegalActions(withEliminatedResponder, 'seat-c')).toEqual([]);
  });

  it('returns no actions for an unknown seat id', () => {
    expect(getLegalActions(state(), 'ghost-seat')).toEqual([]);
  });
});

describe('Reveal (spec: Reveal conditions)', () => {
  const withGenerals = (main: boolean, deputy: boolean) => {
    const s = state();
    s.seats[0].generals = { main: { generalDefinitionId: 'g1', revealed: main }, deputy: { generalDefinitionId: 'g2', revealed: deputy } };
    return s;
  };
  const confirm = (slots: Array<'main' | 'deputy'> = []) => ({ kind: 'ConfirmRevealsAction', seatId: 'seat-a', slots });

  it('offers no Reveal in the Play Phase, however many Generals are hidden', () => {
    expect(getLegalActions(state(), 'seat-a').filter((a) => a.kind === 'ConfirmRevealsAction')).toEqual([]);
    expect(getLegalActions(withGenerals(false, false), 'seat-a')).toEqual(expect.not.arrayContaining([confirm()]));
  });

  it('lists the hidden slots, Main first', () => {
    expect(hiddenSlots(state(), 'seat-a')).toEqual(['main', 'deputy']);
    expect(hiddenSlots(withGenerals(true, false), 'seat-a')).toEqual(['deputy']);
    expect(hiddenSlots(withGenerals(true, true), 'seat-a')).toEqual([]);
  });

  it('offers the Start window one template to confirm with', () => {
    const waiting = state({ phase: 'Start', turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], startWindow: true } });
    expect(getLegalActions(waiting, 'seat-a')).toEqual([confirm()]);
    expect(getLegalActions(waiting, 'seat-b')).toEqual([]);
  });

  it('offers no Reveal while a decision is pending', () => {
    const pending = state({
      pendingResponse: {
        id: 'resp-1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 } },
      },
    });
    expect(getLegalActions(pending, 'seat-a').filter((a) => a.kind === 'ConfirmRevealsAction')).toEqual([]);
  });
});

describe('targetsAllowed', () => {
  it('accepts targets whose keys come in another order', () => {
    const registry: ContentRegistry = { cards: new Map([['sha', { id: 'sha', name: 'Slash', category: 'basic', play: () => [] }]]), generals: new Map() };
    expect(targetsAllowed(state(), 'seat-a', 'c1', 'sha', [{ kind: 'seat', seatId: 'seat-b' }], registry)).toBe(true);
    expect(targetsAllowed(state(), 'seat-a', 'c1', 'sha', [{ seatId: 'seat-b', kind: 'seat' } as Target], registry)).toBe(true);
    expect(targetsAllowed(state(), 'seat-a', 'c1', 'sha', [{ kind: 'seat', seatId: 'seat-c' }], registry)).toBe(false);
  });
});

describe('getLegalActions with a settled judgment', () => {
  const settled = (over: Partial<GameState> = {}) =>
    state({
      judgmentView: { seatId: 'seat-a', reader: { kind: 'card', card: {} as never }, card: { instanceId: 'j', definitionId: 'x', suit: 'club', rank: 3 }, changes: [], settled: true },
      players: [{ id: 'p-b', seatId: 'seat-b', kind: 'human', name: 'B' }],
      ...over,
    });

  it('only the active seat is offered the acknowledgement', () => {
    expect(getLegalActions(settled(), 'seat-b')).toEqual([{ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-b' }]);
    expect(getLegalActions(settled(), 'seat-a')).toEqual([]);
    expect(getLegalActions(settled(), 'seat-c')).toEqual([]);
  });

  it('nothing else is offered while a judgment waits, not even to the turn owner in the Play phase', () => {
    const offered = getLegalActions(settled({ players: [{ id: 'p-a', seatId: 'seat-a', kind: 'human', name: 'A' }] }), 'seat-a');
    expect(offered.map((a) => a.kind)).toEqual(['AcknowledgeJudgmentAction']);
  });
});

describe('a target pick with a cap on some seats', () => {
  const pick = { eligibleIds: ['a', 'b', 'c', 'd'], min: 1, max: 2, capped: { ids: ['c', 'd'], max: 1 } };
  const seats = (...ids: string[]) => ids.map((seatId) => ({ kind: 'seat' as const, seatId }));
  it('fits only while at most `max` of the capped seats are picked', () => {
    expect(fitsPick(pick, seats('c', 'a'))).toBe(true);
    expect(fitsPick(pick, seats('c', 'd'))).toBe(false);
  });
  it('allows a seat to join only if the pick still fits', () => {
    expect(pickAllows(pick, ['c'], 'd')).toBe(false);
    expect(pickAllows(pick, ['c'], 'a')).toBe(true);
    expect(pickAllows(pick, ['a', 'b'], 'c')).toBe(false); // already at max
    expect(pickAllows(pick, ['a'], 'a')).toBe(false); // already picked
  });
});
