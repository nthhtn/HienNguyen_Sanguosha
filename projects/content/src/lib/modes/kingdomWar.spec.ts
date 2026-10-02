import { kingdomWarMode, kingdomWarMaxSeats, GENERALS_PER_SEAT } from './kingdomWar';
import { buildContentRegistry } from '../registry';
import { createGame, resolve, advanceToDecision, getActiveSeatId, getLegalActions, combinedMaxHp } from 'engine';
import type { GameState, CardDefinition, ContentRegistry } from 'engine';

// Skips general selection by seating fixed pairs directly, for tests about
// in-game rules that must not depend on which candidates a seed deals.
function seated(state: GameState, registry: ContentRegistry, picks: Record<string, [string, string]>): GameState {
  return {
    ...state,
    phase: 'Start',
    generalSelection: null,
    seats: state.seats.map((seat) => {
      const [mainId, deputyId] = picks[seat.id];
      const main = registry.generals.get(mainId)!;
      const deputy = registry.generals.get(deputyId)!;
      const maxCombinedHp = combinedMaxHp(main.maxHp, deputy.maxHp);
      return {
        ...seat,
        kingdom: main.kingdom,
        generals: {
          main: { generalDefinitionId: mainId, revealed: false },
          deputy: { generalDefinitionId: deputyId, revealed: false },
        },
        combinedHp: maxCombinedHp,
        maxCombinedHp,
      };
    }),
  };
}

describe('Kingdom War setup and deal', () => {
  const registry = buildContentRegistry();

  it('starts in GeneralSelection with unchosen seats, 4-card hands, and seat-a first', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
    expect(state.phase).toBe('GeneralSelection');
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(getActiveSeatId(state)).toBe('seat-a');
    for (const seat of state.seats) {
      expect(seat.generals).toBeNull();
      expect(seat.kingdom).toBe('hidden');
      expect(seat.combinedHp).toBe(0);
      expect(seat.maxCombinedHp).toBe(0);
      expect(state.zones.find((z) => z.id === seat.hand.zoneId)!.cards).toHaveLength(4);
    }
  });

  it('deals 5 unique registry generals to every seat, each containing a same-kingdom pair', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'], 42);
    const candidates = state.generalSelection!.candidates;
    const all = Object.values(candidates).flat();
    expect(Object.keys(candidates).sort()).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e']);
    expect(all).toHaveLength(5 * GENERALS_PER_SEAT);
    expect(new Set(all).size).toBe(all.length);
    for (const ids of Object.values(candidates)) {
      expect(ids).toHaveLength(GENERALS_PER_SEAT);
      const kingdoms = ids.map((id) => registry.generals.get(id)!.kingdom);
      expect(new Set(kingdoms).size).toBeLessThan(kingdoms.length);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const b = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const c = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 8);
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
    expect(c.generalSelection).not.toEqual(a.generalSelection);
  });

  it('caps the table at floor(generals / 5) seats and rejects fewer than 2', () => {
    expect(kingdomWarMaxSeats(registry)).toBe(5);
    expect(kingdomWarMode.maxSeats!(registry)).toBe(5);
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(() => createGame(kingdomWarMode, registry, six, 1)).toThrow(/between 2 and 5 seats/);
    expect(() => createGame(kingdomWarMode, registry, ['a'], 1)).toThrow(/between 2 and 5 seats/);
  });

  it('a full selection through resolve seats every seat with a same-kingdom pair and starts turn 1', () => {
    let state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42);
    const ctx = { registry, mode: kingdomWarMode };
    while (state.phase === 'GeneralSelection') {
      const seatId = getActiveSeatId(state)!;
      state = resolve(state, getLegalActions(state, seatId, registry)[0], ctx).state;
    }
    // Rests in turn 1's Play phase, unless the dealt table is already one kingdom and the game ended at Start.
    expect(state.phase).toBe(state.result ? 'Start' : 'Play');
    expect(state.generalSelection).toBeNull();
    for (const seat of state.seats) {
      const main = registry.generals.get(seat.generals!.main.generalDefinitionId)!;
      const deputy = registry.generals.get(seat.generals!.deputy.generalDefinitionId)!;
      expect(seat.kingdom).toBe(main.kingdom);
      expect(deputy.kingdom).toBe(main.kingdom);
      expect(seat.maxCombinedHp).toBe(Math.floor((main.maxHp + deputy.maxHp) / 2));
      expect(seat.combinedHp).toBe(seat.maxCombinedHp);
    }
  });

  it('ends the game right after selection if every seat picked the same non-Qun kingdom (Review Focus 1)', () => {
    // Pins current behavior: the existing win rule (one living non-Qun
    // kingdom) is evaluated as soon as the last seat chooses.
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 1);
    const allWei: GameState = {
      ...state,
      generalSelection: {
        candidates: {
          'seat-a': ['cao-cao', 'xu-chu', 'guan-yu', 'lu-xun', 'lu-bu'],
          'seat-b': ['sima-yi', 'guo-jia', 'zhang-fei', 'gan-ning', 'hua-tuo'],
        },
      },
    };
    const ctx = { registry, mode: kingdomWarMode };
    const afterA = resolve(allWei, { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'cao-cao', deputyId: 'xu-chu' }, ctx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'seat-b', mainId: 'sima-yi', deputyId: 'guo-jia' }, ctx).state;
    expect(afterB.result).toEqual({ endedAt: 1, winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b'], losingSeatIds: [] });
  });
});

describe('Kingdom War forced reveal and elimination', () => {
  const testDamageCard: CardDefinition = {
    id: 'test-damage-card', name: 'Test Damage Card', category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 10, nature: 'normal' },
    }],
  };

  it('force-reveals both generals and eliminates the seat on lethal damage, ending the game', () => {
    const registry = buildContentRegistry();
    registry.cards.set('test-damage-card', testDamageCard);
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const base = seated(created, registry, { 'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === base.seats[0].hand.zoneId
          ? { ...z, cards: [{ instanceId: 'lethal-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] }
          : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lethal-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: kingdomWarMode }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.generals!.main.revealed).toBe(true);
    expect(seatB.generals!.deputy.revealed).toBe(true);
    expect(seatB.eliminated).toBe(true);
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });
});

describe('Kingdom War win condition', () => {
  const registry = buildContentRegistry();

  it('returns a real draw result — not null — when every seat is eliminated at once', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    const allEliminated: GameState = {
      ...created,
      seats: created.seats.map((s) => ({ ...s, eliminated: true, combinedHp: 0 })),
    };
    expect(kingdomWarMode.checkWinCondition(allEliminated)).toEqual({
      endedAt: allEliminated.turn.turnNumber,
      winningSeatIds: [],
      losingSeatIds: ['seat-a', 'seat-b'],
    });
  });

  it('still returns null while more than one kingdom is alive', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    expect(kingdomWarMode.checkWinCondition(created)).toBeNull();
  });
});

describe('Kingdom War per-turn draw', () => {
  const registry = buildContentRegistry();

  it('draws 2 cards for whichever seat enters the Draw phase', () => {
    // cao-cao and xu-chu have no hand-coded skills, isolating the mode-level draw.
    const state = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 42), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    const handBefore = state.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = advanceToDecision(state, { registry, mode: kingdomWarMode });

    expect(next.phase).toBe('Play');
    const handAfter = next.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handAfter.cards).toHaveLength(6);
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(2);
  });

  it('draws 3 cards (2 base + 1 Zhuge Liang bonus) when a Zhuge Liang-holding seat enters Draw', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['sun-quan', 'zhou-yu'], 'seat-c': ['zhao-yun', 'zhuge-liang'],
    });
    const seatC = created.seats.find((s) => s.id === 'seat-c')!;
    const state: GameState = { ...created, turn: { turnNumber: 1, ownerSeatId: 'seat-c', extraTurnStack: [] } };
    const originalCardIds = new Set(state.zones.find((z) => z.id === seatC.hand.zoneId)!.cards.map((c) => c.instanceId));

    const { state: next } = advanceToDecision(state, { registry, mode: kingdomWarMode });

    expect(next.phase).toBe('Play');
    const handAfter = next.zones.find((z) => z.id === seatC.hand.zoneId)!;
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(3);
  });
});
