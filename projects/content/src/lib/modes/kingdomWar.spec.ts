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
