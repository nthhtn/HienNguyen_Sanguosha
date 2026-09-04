import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition } from '../registry/types';

function lastSeatStandingMode(): GameModeDefinition {
  return {
    id: 'last-seat-standing',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: (state) => {
      const alive = state.seats.filter((s) => s.combinedHp > 0);
      if (alive.length !== 1) return null;
      return {
        endedAt: state.turn.turnNumber,
        winningSeatIds: [alive[0].id],
        losingSeatIds: state.seats.filter((s) => s.combinedHp <= 0).map((s) => s.id),
      };
    },
    triggers: [],
  };
}

function twoSeatState(): GameState {
  const testDamageCard: CardDefinition = {
    id: 'test-lethal-card', name: 'Test Lethal Card', category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 10, nature: 'normal' },
    }],
  };
  const registry: ContentRegistry = { cards: new Map([['test-lethal-card', testDamageCard]]), generals: new Map() };
  const state: GameState = {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'c1', definitionId: 'test-lethal-card', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null,
  };
  return { state, registry };
}

describe('resolve: generic win-condition wiring', () => {
  it('attaches a GameResult once checkWinCondition finds a winner', () => {
    const { state, registry } = twoSeatState();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: lastSeatStandingMode() }
    );
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });

  it('rejects any further action once the game has a result', () => {
    const { state, registry } = twoSeatState();
    const { state: ended } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: lastSeatStandingMode() }
    );
    expect(() =>
      resolve(ended, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry, mode: lastSeatStandingMode() })
    ).toThrow(/game has ended/);
  });
});
