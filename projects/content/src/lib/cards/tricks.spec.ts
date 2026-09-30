// projects/content/src/lib/cards/tricks.spec.ts
import { duelCard } from './duel';
import { wuxieCard } from './wuxie';
import { silverLionCard, greenDragonBladeCard } from './equipment';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition } from 'engine';

function registry(): ContentRegistry {
  return {
    cards: new Map([
      [duelCard.id, duelCard],
      [wuxieCard.id, wuxieCard],
      [silverLionCard.id, silverLionCard],
      [greenDragonBladeCard.id, greenDragonBladeCard],
      // a fixture 'sha' stand-in so Duel's allowedCardIds check has something to accept:
      ['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }],
    ]),
    generals: new Map(),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function twoSeatState(seatAHandCardId: string): GameState {
  return {
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
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'card-1', definitionId: seatAHandCardId, suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

function withSeatBHand(state: GameState, cardId: string, instanceId: string): GameState {
  return {
    ...state,
    zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId, definitionId: cardId, suit: 'club' as const, rank: 3 }] } : z)),
  };
}

describe('Duel and Wuxie Kongjie', () => {
  it('deals 2 damage to the target if they Pass, and the Duel card ends up in the discard pile', () => {
    const state = twoSeatState('duel');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(4);
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
  });

  it('is cancelled if the target responds with Sha, and both cards end up in the discard pile', () => {
    let state = twoSeatState('duel');
    state = withSeatBHand(state, 'sha', 'sha-1');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1', cardInstanceId: 'sha-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId).sort()).toEqual(['card-1', 'sha-1']);
  });

  it('is cancelled if the target responds with Wuxie Kongjie', () => {
    let state = twoSeatState('duel');
    state = withSeatBHand(state, 'wuxie', 'wuxie-1');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1', cardInstanceId: 'wuxie-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('played with no target is a no-op rather than throwing', () => {
    const state = twoSeatState('duel');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.pendingResponse).toBeNull();
  });
});

describe('Equipment', () => {
  it('Silver Lion moves from hand to the equip zone when played', () => {
    const state = twoSeatState('silver-lion');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
    // equipment is exempt from discard-after-play
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards).toHaveLength(0);
  });

  it('Green Dragon Blade moves from hand to the equip zone when played', () => {
    const state = twoSeatState('green-dragon-blade');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
  });
});
