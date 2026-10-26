import { withFillers } from '../generals/fillers.testing';
import { getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, Kingdom } from 'engine';
import { buildContentRegistry } from '../registry';
import { alternateCardData } from '../alternateCards';

const registry = withFillers(buildContentRegistry());
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const pile = (n: number) => Array.from({ length: n }, (_, i) => card(`p${i}`, 'sha', 'club', i + 1));

// Four seats (a, b, c, d) at 4/4 HP; a's Play phase; `kingdoms` per seat.
function table(kingdoms: Kingdom[], cards: Record<string, CardInstance[]> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: kingdoms[index], eliminated: false,
      generals: { main: { generalDefinitionId: 'filler-xu-huang', revealed: kingdoms[index] !== 'hidden' }, deputy: { generalDefinitionId: 'filler-dong-zhuo', revealed: kingdoms[index] !== 'hidden' } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? pile(12) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, target: string) => act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'af', targets: [{ kind: 'seat', seatId: target }] });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const hand = (s: GameState, seatId: string) => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards.map((c) => c.instanceId);
const af = card('af', 'ally-far-attack-near', 'heart', 3);
const targetsOf = (s: GameState) =>
  getLegalActions(s, 'seat-a', registry)
    .filter((x) => x.kind === 'PlayCardAction' && x.cardInstanceId === 'af')
    .map((x) => (x as { targets: { seatId: string }[] }).targets.map((t) => t.seatId));

describe('Ally Far Attack Near', () => {
  it('is a Tool', () => {
    expect(registry.cards.get('ally-far-attack-near')).toMatchObject({ id: 'ally-far-attack-near', category: 'tool', name: 'Ally Far Attack Near' });
  });

  it('offers only exposed seats of another Kingdom', () => {
    const s = table(['Wei', 'Shu', 'Wei', 'hidden'], { 'seat-a:hand': [af] });
    expect(targetsOf(s)).toEqual([['seat-b']]);
  });

  it('a hidden user may target any exposed other seat', () => {
    const s = table(['hidden', 'Shu', 'Wei', 'hidden'], { 'seat-a:hand': [af] });
    expect(targetsOf(s)).toEqual([['seat-b'], ['seat-c']]);
  });

  it('is not playable when no other seat qualifies', () => {
    expect(targetsOf(table(['Wei', 'Wei', 'hidden', 'hidden'], { 'seat-a:hand': [af] }))).toEqual([]);
    expect(targetsOf(table(['hidden', 'hidden', 'hidden', 'hidden'], { 'seat-a:hand': [af] }))).toEqual([]);
  });

  it('never targets an eliminated seat', () => {
    const s0 = table(['Wei', 'Shu', 'Qun', 'hidden'], { 'seat-a:hand': [af] });
    const s = { ...s0, seats: s0.seats.map((x) => (x.id === 'seat-b' ? { ...x, eliminated: true } : x)) };
    expect(targetsOf(s)).toEqual([['seat-c']]);
  });

  it('the target draws 1 then the user draws 3', () => {
    const s = play(table(['Wei', 'Shu', 'Wei', 'Qun'], { 'seat-a:hand': [af] }), 'seat-b');
    expect(hand(s, 'seat-b')).toEqual(['p0']);
    expect(hand(s, 'seat-a')).toEqual(['p1', 'p2', 'p3']);
    expect(hand(s, 'seat-c')).toEqual([]);
  });

  it('one Wuxie cancels both draws', () => {
    let s = play(table(['Wei', 'Shu', 'Wei', 'Qun'], { 'seat-a:hand': [af], 'seat-d:hand': [card('w1', 'wuxie')] }), 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie', target: { seatId: 'seat-b' } } });
    s = respond(s, 'w1');
    expect(hand(s, 'seat-b')).toEqual([]);
    expect(hand(s, 'seat-a')).toEqual([]);
  });

  it('with the Wuxie passed, both draws happen', () => {
    let s = play(table(['Wei', 'Shu', 'Wei', 'Qun'], { 'seat-a:hand': [af], 'seat-d:hand': [card('w1', 'wuxie')] }), 'seat-b');
    s = pass(s);
    expect(hand(s, 'seat-b')).toHaveLength(1);
    expect(hand(s, 'seat-a')).toHaveLength(3);
  });
});

describe('Ally Far Attack Near and Ambitionists', () => {
  it('an Ambitionist is a legal target for anyone, even of its printed Kingdom, and may target everyone', () => {
    const base = table(['Wei', 'Wei', 'Wei', 'Shu'], { 'seat-a:hand': [af] });
    const withB = { ...base, seats: base.seats.map((x) => (x.id === 'seat-b' ? { ...x, allegiance: 'ambitionist' as const } : x)) };
    expect(targetsOf(withB)).toEqual([['seat-b'], ['seat-d']]);
    const asAmbitionist = { ...base, seats: base.seats.map((x) => (x.id === 'seat-a' ? { ...x, allegiance: 'ambitionist' as const } : x)) };
    expect(targetsOf(asAmbitionist)).toEqual([['seat-b'], ['seat-c'], ['seat-d']]);
  });
});
