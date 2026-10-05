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
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
  const discardIds = (s: GameState) => s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId).sort();
  const withHand = (state: GameState, seatId: string, cards: [string, string][]): GameState => ({
    ...state,
    zones: state.zones.map((z) =>
      z.id === `${seatId}:hand`
        ? { ...z, cards: [...z.cards, ...cards.map(([definitionId, instanceId]) => ({ instanceId, definitionId, suit: 'club' as const, rank: 3 }))] }
        : z
    ),
  });
  const duel = (state: GameState) =>
    resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx()).state;
  const sha = (state: GameState, seatId: string, cardInstanceId: string) =>
    resolve(state, { kind: 'RespondAction', seatId, pendingResponseId: state.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (state: GameState, seatId: string) =>
    resolve(state, { kind: 'PassAction', seatId, pendingResponseId: state.pendingResponse!.id }, ctx()).state;

  it('deals 1 damage from the user to a target who plays no Sha, and the Duel ends up in the discard pile', () => {
    const next = pass(duel(twoSeatState('duel')), 'seat-b');
    expect(hp(next, 'seat-b')).toBe(5);
    expect(hp(next, 'seat-a')).toBe(7);
    const damage = next.log.find((e) => e.kind === 'DamageDealtEvent')!;
    expect(damage).toMatchObject({ damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 } });
    expect(next.pendingResponse).toBeNull();
    expect(discardIds(next)).toEqual(['card-1']);
  });

  it('turns back to the user once the target plays a Sha: now the user must play one', () => {
    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]));
    const answered = sha(opened, 'seat-b', 'b-sha-1');
    expect(answered.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    expect(hp(answered, 'seat-b')).toBe(6);
  });

  it('hurts the user, from the target, when the user cannot answer the target’s Sha', () => {
    const answered = sha(duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']])), 'seat-b', 'b-sha-1');
    const next = pass(answered, 'seat-a');
    expect(hp(next, 'seat-a')).toBe(6);
    expect(hp(next, 'seat-b')).toBe(6);
    expect(next.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({
      damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 },
    });
    expect(next.pendingResponse).toBeNull();
    expect(discardIds(next)).toEqual(['b-sha-1', 'card-1']);
  });

  it('alternates for as long as both keep playing Sha; the first to stop takes the damage', () => {
    let state = withHand(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1'], ['sha', 'b-sha-2']]), 'seat-a', [['sha', 'a-sha-1']]);
    state = duel(state);
    state = sha(state, 'seat-b', 'b-sha-1');
    state = sha(state, 'seat-a', 'a-sha-1');
    expect(state.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    state = sha(state, 'seat-b', 'b-sha-2');
    expect(state.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
    state = pass(state, 'seat-a');
    expect(hp(state, 'seat-a')).toBe(6);
    expect(hp(state, 'seat-b')).toBe(6);
    expect(discardIds(state)).toEqual(['a-sha-1', 'b-sha-1', 'b-sha-2', 'card-1']);
    // Shas played in a Duel are responses: they don't use up the turn's Sha play.
    expect(state.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('can be cancelled with Wuxie Kongjie only by the target, before any Sha', () => {
    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['wuxie', 'wuxie-1']]));
    expect(opened.pendingResponse!.allowedCardIds).toEqual(['sha', 'wuxie']);
    const next = sha(opened, 'seat-b', 'wuxie-1');
    expect(hp(next, 'seat-b')).toBe(6);
    expect(next.pendingResponse).toBeNull();

    const later = sha(duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']])), 'seat-b', 'b-sha-1');
    expect(later.pendingResponse!.allowedCardIds).toEqual(['sha']);
  });

  it('an untargeted Duel is not a legal play, and its play() stays a defensive no-op', () => {
    const state = twoSeatState('duel');
    expect(() =>
      resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() })
    ).toThrow('Card duel cannot be played with those targets');
    expect(duelCard.play(state, { seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] })).toEqual([]);
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
