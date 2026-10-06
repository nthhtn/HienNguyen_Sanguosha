import { shaCard } from './sha';
import { shanCard } from './shan';
import { peachCard } from './peach';
import { resolve, usedCardOf } from 'engine';
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
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 1 }, { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 5 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'shan-1', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

function stubMode() {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as any, checkWinCondition: () => null, triggers: [] };
}

describe('Sha/Shan/Peach', () => {
  it('Sha deals 1 damage when the target has no Shan to respond with, and Sha lands in the discard pile', () => {
    let state = twoSeatState();
    state = { ...state, zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [] } : z)) };
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: opened.state.pendingResponse!.id }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(5);
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards.map((c) => c.instanceId)).toEqual(['peach-1']);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['sha-1']);
  });

  it('Shan prevents Sha\'s damage when played in response, and both cards land in the discard pile', () => {
    const state = twoSeatState();
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: opened.state.pendingResponse!.id, cardInstanceId: 'shan-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.zones.find((z) => z.id === 'seat-b:hand')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId).sort()).toEqual(['sha-1', 'shan-1']);
  });

  it('logs who used which card on whom, and what a response answered', () => {
    const opened = resolve(twoSeatState(), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: opened.state.pendingResponse!.id, cardInstanceId: 'shan-1' }, { registry: registry(), mode: stubMode() });
    expect(next.log.filter((e) => e.kind === 'CardPlayedEvent')).toEqual([
      {
        kind: 'CardPlayedEvent', seatId: 'seat-a', targets: [{ kind: 'seat', seatId: 'seat-b' }],
        card: { as: 'sha', colour: 'black', suit: 'spade', rank: 1, physical: [{ instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      },
      {
        kind: 'CardPlayedEvent', seatId: 'seat-b', targets: [], inResponseTo: { seatId: 'seat-a', cardInstanceId: 'sha-1' },
        card: { as: 'shan', colour: 'black', suit: 'club', rank: 2, physical: [{ instanceId: 'shan-1', definitionId: 'shan', suit: 'club', rank: 2 }] },
      },
    ]);
  });

  it('Peach heals the playing seat up to maxCombinedHp and lands in the discard pile', () => {
    const state = twoSeatState();
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'peach-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(7);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['peach-1']);
  });

  it('an untargeted Sha is not a legal play, and its play() stays a defensive no-op', () => {
    const state = twoSeatState();
    expect(() =>
      resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [] }, { registry: registry(), mode: stubMode() })
    ).toThrow('Card sha cannot be played with those targets');
    expect(shaCard.play(state, { seatId: 'seat-a', cardInstanceId: 'sha-1', card: usedCardOf(state.zones[1].cards[0]), targets: [] }, registry())).toEqual([]);
  });
});
