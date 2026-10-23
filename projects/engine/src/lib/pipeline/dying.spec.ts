import { resolve } from './resolve';
import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';

// A stand-in Peach: as a response it does nothing itself — the dying window heals.
const registry: ContentRegistry = {
  cards: new Map([
    ['peach', { id: 'peach', name: 'Peach', category: 'basic', play: () => [] }],
    ['wine', { id: 'wine', name: 'Wine', category: 'basic', play: () => [] }],
  ]),
  generals: new Map(),
};
const mode: GameModeDefinition = {
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [],
};
const ctx = { registry, mode };
const peach = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'peach', suit: 'heart', rank: 12 });

// Four seats; seat-b's turn. seat-c is the one in trouble.
function state(hp: number, hands: Record<string, CardInstance[]> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false,
      generals: { main: { generalDefinitionId: 'g1', revealed: true }, deputy: { generalDefinitionId: 'g2', revealed: true } },
      combinedHp: id === 'seat-c' ? hp : 3, maxCombinedHp: 3,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-b', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: hands[id] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const ORDER = ['seat-b', 'seat-c', 'seat-d', 'seat-a'];
const dying = (s: GameState) => applyEffect(s, { kind: 'DyingEffect', seatId: 'seat-c', order: ORDER, rescueCardIds: { any: ['peach'], self: ['wine'] }, entering: true }).state;
const hpOf = (s: GameState) => s.seats.find((x) => x.id === 'seat-c')!.combinedHp;
const asked = (s: GameState) => s.pendingResponse?.respondingSeatId ?? null;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: asked(s)!, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const givePeach = (s: GameState, cardInstanceId: string) =>
  resolve(s, { kind: 'RespondAction', seatId: asked(s)!, pendingResponseId: s.pendingResponse!.id, cardInstanceId } as Action, ctx).state;

describe('damage below zero', () => {
  it('takes HP past 0 by the full amount', () => {
    const next = applyEffect(state(1), {
      kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-c' }, amount: 3, nature: 'normal' },
    }).state;
    expect(hpOf(next)).toBe(-2);
  });
});

describe('the dying round', () => {
  it('names the damage source on the dying event when the effect carries one', () => {
    const s = applyEffect(state(0), { kind: 'DyingEffect', seatId: 'seat-c', order: ORDER, rescueCardIds: { any: ['peach'], self: ['wine'] }, entering: true, killerSeatId: 'seat-a' }).state;
    expect(s.log).toEqual([{ kind: 'SeatDyingEvent', seatId: 'seat-c', killerSeatId: 'seat-a' }]);
  });

  it('logs the seat as dying and asks it first when no one else holds a Peach', () => {
    const s = dying(state(0));
    expect(s.log).toEqual([{ kind: 'SeatDyingEvent', seatId: 'seat-c' }]);
    expect(asked(s)).toBe('seat-c');
    expect(s.pendingResponse).toMatchObject({ allowedCardIds: ['peach', 'wine'], reason: { kind: 'dying', seatId: 'seat-c' } });
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(false);
  });

  it('asks from the turn owner on, skipping other seats without a Peach', () => {
    const s = dying(state(0, { 'seat-b': [peach('pb')], 'seat-a': [peach('pa')] }));
    expect(asked(s)).toBe('seat-b');
    const afterB = pass(s);
    expect(asked(afterB)).toBe('seat-c'); // always asked, even empty-handed
    const afterC = pass(afterB);
    expect(asked(afterC)).toBe('seat-a'); // seat-d holds no Peach
  });

  it('eliminates the seat once everyone asked has passed', () => {
    const s = pass(pass(dying(state(0, { 'seat-d': [peach('pd')] }))));
    expect(s.pendingResponse).toBeNull();
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
    expect(s.log.at(-1)).toEqual({ kind: 'SeatEliminatedEvent', seatId: 'seat-c' });
  });

  it('is saved by another seat’s Peach, which goes to the discard pile', () => {
    const s = givePeach(dying(state(0, { 'seat-b': [peach('pb')] })), 'pb');
    expect(hpOf(s)).toBe(1);
    expect(s.pendingResponse).toBeNull();
    expect(s.log.at(-1)).toEqual({ kind: 'SeatSavedEvent', seatId: 'seat-c' });
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['pb']);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'seat-b', inResponseTo: { dyingSeatId: 'seat-c' } });
  });

  it('asks the same seat again while more Peaches are needed', () => {
    let s = dying(state(-1, { 'seat-b': [peach('pb1'), peach('pb2')], 'seat-d': [peach('pd')] }));
    s = givePeach(s, 'pb1');
    expect(hpOf(s)).toBe(0);
    expect(asked(s)).toBe('seat-b');
    s = givePeach(s, 'pb2');
    expect(hpOf(s)).toBe(1);
    expect(s.pendingResponse).toBeNull();
  });

  it('lets the dying seat save itself', () => {
    const s = givePeach(dying(state(0, { 'seat-c': [peach('pc')] })), 'pc');
    expect(hpOf(s)).toBe(1);
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(false);
  });

  it('does nothing for a seat that is not at 0 or below', () => {
    const s = applyEffect(state(2), { kind: 'DyingEffect', seatId: 'seat-c', order: ORDER, rescueCardIds: { any: ['peach'], self: ['wine'] } }).state;
    expect(s.pendingResponse).toBeNull();
    expect(s.log).toEqual([{ kind: 'SeatSavedEvent', seatId: 'seat-c' }]);
  });
});

describe('self-only rescue cards', () => {
  const wine = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'wine', suit: 'spade', rank: 9 });

  it('the dying seat may answer with a self-only card; another seat may not', () => {
    // seat-b (turn owner) holds a Peach, so it is asked first, for Peach only.
    const first = dying(state(0, { 'seat-b': [peach('p1')], 'seat-c': [wine('w1')] }));
    expect(first.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['peach'] });
    const own = pass(first);
    expect(own.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['peach', 'wine'] });
    const saved = givePeach(own, 'w1');
    expect(hpOf(saved)).toBe(1);
    expect(saved.log).toContainEqual({ kind: 'SeatSavedEvent', seatId: 'seat-c' });
  });

  it('never asks a seat that holds only a self-only card (Review Focus 4)', () => {
    const s = dying(state(0, { 'seat-d': [wine('w1')] }));
    // seat-b has nothing; the dying seat-c is asked; seat-d (Wine only) is skipped.
    expect(asked(s)).toBe('seat-c');
    const next = pass(s);
    expect(next.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
  });
});
