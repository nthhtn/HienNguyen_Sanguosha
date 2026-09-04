import { shaCard } from './sha';
import { shanCard } from './shan';
import { peachCard } from './peach';
import { resolve } from 'engine';
import type { GameState, ContentRegistry } from 'engine';

function registry(): ContentRegistry {
  return {
    cards: new Map([[shaCard.id, shaCard], [shanCard.id, shanCard], [peachCard.id, peachCard]]),
    generals: new Map(),
  };
}

function twoSeatState(): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 6, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 1 }, { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 5 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'shan-1', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

function stubMode() {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as any, checkWinCondition: () => null, triggers: [] };
}

describe('Sha/Shan/Peach', () => {
  it('Sha deals 1 damage when the target has no Shan to respond with', () => {
    let state = twoSeatState();
    state = { ...state, zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [] } : z)) };
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'sha-response-sha-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(5);
  });

  it('Shan prevents Sha\'s damage when played in response', () => {
    const state = twoSeatState();
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'sha-response-sha-1', cardInstanceId: 'shan-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('Peach heals the playing seat up to maxCombinedHp', () => {
    const state = twoSeatState();
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'peach-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(7);
  });

  it('Sha played with no target is a no-op rather than throwing (guards the legality module\'s untargeted variant)', () => {
    const state = twoSeatState();
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.pendingResponse).toBeNull();
  });
});
