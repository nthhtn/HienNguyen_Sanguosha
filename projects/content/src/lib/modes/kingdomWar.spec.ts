import { kingdomWarMode } from './kingdomWar';
import { buildContentRegistry } from '../registry';
import { createGame, resolve } from 'engine';
import type { GameState, GameModeDefinition, CardDefinition, ContentRegistry } from 'engine';

describe('Kingdom War setup', () => {
  it('assigns kingdoms round-robin, sets combined HP from both generals, and deals 4 cards to each seat', () => {
    const registry = buildContentRegistry();
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
    expect(state.seats.map((s) => s.kingdom)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    for (const seat of state.seats) {
      const main = registry.generals.get(seat.generals.main.generalDefinitionId)!;
      const deputy = registry.generals.get(seat.generals.deputy.generalDefinitionId)!;
      expect(seat.maxCombinedHp).toBe(main.maxHp + deputy.maxHp);
      expect(seat.combinedHp).toBe(seat.maxCombinedHp);
      expect(seat.generals.main.revealed).toBe(false);
      expect(seat.generals.deputy.revealed).toBe(false);
      const hand = state.zones.find((z) => z.id === seat.hand.zoneId)!;
      expect(hand.cards).toHaveLength(4);
    }
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(state.phase).toBe('Judgment');
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

  function registryWithLethalCard(): ContentRegistry {
    const base = buildContentRegistry();
    base.cards.set('test-damage-card', testDamageCard);
    return base;
  }

  function twoSeatState(): GameState {
    const registry = registryWithLethalCard();
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    return {
      ...state,
      zones: state.zones.map((z) =>
        z.id === state.seats[0].hand.zoneId
          ? { ...z, cards: [{ instanceId: 'lethal-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] }
          : z
      ),
    };
  }

  it('force-reveals both generals and eliminates the seat on lethal damage, ending the game', () => {
    const registry = registryWithLethalCard();
    const state = twoSeatState();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lethal-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: kingdomWarMode }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.generals.main.revealed).toBe(true);
    expect(seatB.generals.deputy.revealed).toBe(true);
    expect(seatB.eliminated).toBe(true);
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });
});

describe('Kingdom War win condition', () => {
  it('returns a real draw result — not null — when every seat is eliminated at once', () => {
    const registry = buildContentRegistry();
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3);
    const allEliminated: GameState = {
      ...created,
      seats: created.seats.map((s) => ({ ...s, eliminated: true, combinedHp: 0 })),
    };
    // null would mean "the game continues", which for a table with no living
    // seats would never terminate.
    expect(kingdomWarMode.checkWinCondition(allEliminated)).toEqual({
      endedAt: allEliminated.turn.turnNumber,
      winningSeatIds: [],
      losingSeatIds: ['seat-a', 'seat-b'],
    });
  });

  it('still returns null while more than one kingdom is alive', () => {
    const registry = buildContentRegistry();
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3);
    expect(kingdomWarMode.checkWinCondition(created)).toBeNull();
  });
});

describe('Kingdom War per-turn draw', () => {
  it('draws 2 cards for whichever seat enters the Draw phase', () => {
    const registry = buildContentRegistry();
    // seat-a (index 0) is assigned dong-zhuo/huang-yueying here — neither is
    // zhuge-liang — so this isolates the mode-level draw from the general-skill
    // bonus draw (see the Zhuge Liang case below).
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 42);
    const handBefore = state.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = resolve(
      state,
      { kind: 'EndPhaseAction', seatId: 'seat-a' },
      { registry, mode: kingdomWarMode }
    );

    expect(next.phase).toBe('Draw');
    const handAfter = next.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handAfter.cards).toHaveLength(6);
    const newCardIds = handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id));
    expect(newCardIds).toHaveLength(2);
  });

  it('draws 3 cards (2 base + 1 Zhuge Liang bonus) when a Zhuge Liang-holding seat enters Draw', () => {
    const registry = buildContentRegistry();
    // With 3 seats, seat index 2 ("seat-c") is assigned zhuge-liang as deputy
    // (and, uniquely among this content registry's 6 defined generals, no
    // other seat also gets zhuge-liang at this seat count — see kingdomWar's
    // round-robin general assignment: with 6 generals total, seat counts of
    // 6+ start assigning the same general to more than one seat, which would
    // double-fire this general's own trigger and make the assertion below
    // about "the" Zhuge Liang bonus ambiguous).
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42);
    const seatC = created.seats.find((s) => s.id === 'seat-c')!;
    expect(seatC.generals.deputy.generalDefinitionId).toBe('zhuge-liang');
    const state: GameState = { ...created, phase: 'Judgment', turn: { turnNumber: 1, ownerSeatId: 'seat-c', extraTurnStack: [] } };
    const handBefore = state.zones.find((z) => z.id === seatC.hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = resolve(
      state,
      { kind: 'EndPhaseAction', seatId: 'seat-c' },
      { registry, mode: kingdomWarMode }
    );

    expect(next.phase).toBe('Draw');
    const handAfter = next.zones.find((z) => z.id === seatC.hand.zoneId)!;
    const newCardIds = handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id));
    expect(newCardIds).toHaveLength(3);
  });
});
