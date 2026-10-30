import { buildContentRegistry } from 'content';
import { redactStateForSeat, resolve } from 'engine';
import type { CardInstance, EngineEvent, GameModeDefinition, GameState } from 'engine';
import { foldEvent } from './displayed-state';

const card = (instanceId: string, definitionId = 'shan', rank = 1): CardInstance => ({ instanceId, definitionId, suit: 'heart', rank });
const hidden = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'hidden', suit: 'spade', rank: 0 });

// Four seats in a row (a b c d), each at 3/4 HP, a holding a Slash.
function fourSeats(): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], combinedHp: 3, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => card(`d${n}`, 'shan', n)) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'a' ? [{ ...card('a-sha', 'sha', 7), suit: 'spade' as const }] : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const zone = (state: GameState, id: string) => state.zones.find((z) => z.id === id)!;
const hp = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId)!.combinedHp;

describe('foldEvent', () => {
  it('damage lowers HP on the target only', () => {
    const state = fourSeats();
    const next = foldEvent(state, { kind: 'DamageDealtEvent', damage: { source: { kind: 'seat', seatId: 'a' }, target: { kind: 'seat', seatId: 'b' }, amount: 2 } } as EngineEvent, state);
    expect(state.seats.map((s) => s.combinedHp)).toEqual([3, 3, 3, 3]);
    expect(next.seats.map((s) => s.combinedHp)).toEqual([3, 1, 3, 3]);
  });

  it('heal raises HP', () => {
    const state = fourSeats();
    const next = foldEvent(state, { kind: 'HealEvent', target: { kind: 'seat', seatId: 'c' }, amount: 1 }, state);
    expect(hp(next, 'c')).toBe(4);
  });

  it('a move to the discard pile takes the face from the event', () => {
    const state = fourSeats();
    const face = { ...card('a-sha', 'sha', 7), suit: 'spade' as const };
    const next = foldEvent(state, { kind: 'CardMovedEvent', cardInstanceId: 'a-sha', fromZoneId: 'a:hand', toZoneId: 'discardPile', card: face }, state);
    expect(zone(next, 'a:hand').cards).toEqual([]);
    expect(zone(next, 'discardPile').cards).toEqual([face]);
    expect(zone(state, 'a:hand').cards).toHaveLength(1);
  });

  it("a draw into the viewer's hand takes faces from the target state", () => {
    const state = fourSeats();
    const target: GameState = { ...state, zones: state.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [...z.cards, card('d1', 'shan', 1)] } : z.id === 'drawPile' ? { ...z, cards: z.cards.slice(1) } : z)) };
    const next = foldEvent(state, { kind: 'CardsDrawnEvent', seatId: 'a', cardInstanceIds: ['d1'] }, target);
    expect(zone(next, 'a:hand').cards.map((c) => c.definitionId)).toEqual(['sha', 'shan']);
    expect(zone(next, 'drawPile').cards.map((c) => c.instanceId)).toEqual(['d2', 'd3', 'd4']);
  });

  it("a draw into another seat's hand stays hidden", () => {
    const state = fourSeats();
    const target: GameState = { ...state, zones: state.zones.map((z) => (z.id === 'b:hand' ? { ...z, cards: [hidden('d1')] } : z.id === 'drawPile' ? { ...z, cards: z.cards.slice(1) } : z)) };
    const next = foldEvent(state, { kind: 'CardsDrawnEvent', seatId: 'b', cardInstanceIds: ['d1'] }, target);
    expect(zone(next, 'b:hand').cards).toEqual([hidden('d1')]);
  });

  it('ignores unknown zones and seats', () => {
    const state = fourSeats();
    const move = foldEvent(state, { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'nowhere', toZoneId: 'elsewhere' }, state);
    expect(move).toEqual(state);
    const heal = foldEvent(state, { kind: 'HealEvent', target: { kind: 'seat', seatId: 'zz' }, amount: 1 }, state);
    expect(heal).toEqual(state);
  });

  it('caps HP at the new maximum, and folds turn, phase and elimination', () => {
    let state = fourSeats();
    state = foldEvent(state, { kind: 'MaxHpReducedEvent', seatId: 'b', amount: 2, maxHp: 2 }, state);
    expect(state.seats[1]).toMatchObject({ combinedHp: 2, maxCombinedHp: 2 });
    state = foldEvent(state, { kind: 'SeatEliminatedEvent', seatId: 'c' } as EngineEvent, state);
    expect(state.seats[2].eliminated).toBe(true);
    state = foldEvent(state, { kind: 'TurnAdvancedEvent', seatId: 'd', turnNumber: 2 } as EngineEvent, state);
    expect(state.turn.ownerSeatId).toBe('d');
    state = foldEvent(state, { kind: 'PhaseChangedEvent', seatId: 'd', phase: 'Discard' } as EngineEvent, state);
    expect(state.phase).toBe('Discard');
  });

  it('copies a seat\'s Generals from the target on reveal', () => {
    const state = fourSeats();
    const target: GameState = { ...state, seats: state.seats.map((s) => (s.id === 'b' ? { ...s, generals: { main: { generalDefinitionId: 'zhangfei', revealed: true }, deputy: s.generals!.deputy } } : s)) };
    const next = foldEvent(state, { kind: 'GeneralRevealedEvent', seatId: 'b', slot: 'main' }, target);
    expect(next.seats[1].generals!.main.generalDefinitionId).toBe('zhangfei');
  });

  it.each(['a', 'b'])('folding every event of a resolve call reaches the target for viewer %s', (viewer) => {
    const registry = buildContentRegistry();
    const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
    const ctx = { registry, mode };
    const start: GameState = { ...fourSeats(), rules: { logPasses: true } };
    const played = resolve(start, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'a-sha', targets: [{ kind: 'seat', seatId: 'b' }] }, ctx).state;
    expect(played.pendingResponse).toMatchObject({ respondingSeatId: 'b' });
    const hit = resolve(played, { kind: 'PassAction', seatId: 'b', pendingResponseId: played.pendingResponse!.id }, ctx).state;
    const after = resolve(hit, { kind: 'DrawCardsAction', seatId: 'c', count: 2 }, ctx).state;
    expect(hp(after, 'b')).toBe(2);
    expect(after.log.some((e) => e.kind === 'ResponsePassedEvent')).toBe(true);

    const before = redactStateForSeat(start, viewer);
    const target = redactStateForSeat(after, viewer);
    const folded = after.log.slice(start.log.length).reduce((s, e) => foldEvent(s, e, target), before);

    expect(folded.seats.map((s) => [s.combinedHp, s.maxCombinedHp, s.eliminated])).toEqual(target.seats.map((s) => [s.combinedHp, s.maxCombinedHp, s.eliminated]));
    const handCounts = (s: GameState) => s.zones.filter((z) => z.kind === 'hand').map((z) => [z.id, z.cards.length]);
    expect(handCounts(folded)).toEqual(handCounts(target));
    const ids = (s: GameState, id: string) => zone(s, id).cards.map((c) => c.instanceId);
    expect(ids(folded, 'discardPile')).toEqual(ids(target, 'discardPile'));
    expect(zone(folded, 'discardPile').cards).toEqual(zone(target, 'discardPile').cards);
    expect(ids(folded, 'drawPile')).toEqual(ids(target, 'drawPile'));
  });
});
