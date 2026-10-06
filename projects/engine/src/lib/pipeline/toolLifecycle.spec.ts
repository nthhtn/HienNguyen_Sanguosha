import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { usedCardOf } from '../domain/usedCard';
import { livingSeatOrderFrom } from '../rules/seatOrder';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// A fixture Tool: targets every other living seat (seat order from the user)
// and, on each, heals it by 1. The counter card is 'counter'.
const blessing: CardDefinition = {
  id: 'blessing',
  name: 'Blessing',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => {
    const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === ctx.cardInstanceId)!;
    return livingSeatOrderFrom(state, ctx.seatId).slice(1).map((seatId) => ({
      kind: 'ToolOnTargetEffect',
      tool: usedCardOf(card),
      userSeatId: ctx.seatId,
      target: { kind: 'seat', seatId },
      counterCardIds: ['counter'],
    }));
  },
  onTarget: (_state, ctx) => [{ kind: 'HealEffect', target: ctx.target, amount: 1 }],
};
const counter: CardDefinition = { id: 'counter', name: 'Counter', category: 'tool', legalPlayTargets: () => [], play: () => [] };
const ctx = { registry: { cards: new Map([[blessing.id, blessing], [counter.id, counter]]), generals: new Map() } as ContentRegistry, mode };

// Seats a (user, index 0), b, c, d — all at 2/4 HP. `counters` lists who holds a counter card.
function table(counters: string[] = [], eliminated: string[] = []): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, combinedHp: 2, maxCombinedHp: 4, eliminated: eliminated.includes(id),
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        {
          id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id,
          cards: [
            ...(id === 'a' ? [{ instanceId: 'bless', definitionId: 'blessing', suit: 'heart' as const, rank: 1 }] : []),
            ...(counters.includes(id) ? [{ instanceId: `${id}-counter`, definitionId: 'counter', suit: 'spade' as const, rank: 11 }] : []),
          ],
        },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const playBlessing = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'bless', targets: [] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const counterWith = (s: GameState) => {
  const seatId = s.pendingResponse!.respondingSeatId;
  return resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId: `${seatId}-counter` }, ctx).state;
};
const hp = (s: GameState) => Object.fromEntries(s.seats.map((x) => [x.id, x.combinedHp]));

describe('livingSeatOrderFrom', () => {
  it('lists living seats in turn order from the given seat, wrapping, skipping the eliminated', () => {
    expect(livingSeatOrderFrom(table([], ['c']), 'b')).toEqual(['b', 'd', 'a']);
  });
});

describe('usedCardOf', () => {
  it('wraps one physical card with its colour, suit and rank', () => {
    expect(usedCardOf({ instanceId: 'x', definitionId: 'sha', suit: 'diamond', rank: 9 })).toEqual({
      as: 'sha', colour: 'red', suit: 'diamond', rank: 9, physical: [{ instanceId: 'x', definitionId: 'sha', suit: 'diamond', rank: 9 }],
    });
    expect(usedCardOf({ instanceId: 'y', definitionId: 'sha', suit: 'club', rank: 2 }).colour).toBe('black');
  });
});

describe('the Tool lifecycle', () => {
  it('applies the Tool to each target in order when nobody holds a counter card', () => {
    const next = playBlessing(table());
    expect(next.pendingResponse).toBeNull();
    expect(hp(next)).toEqual({ a: 2, b: 3, c: 3, d: 3 });
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('asks only counter holders, starting with the user, with a wuxie reason', () => {
    const asked = playBlessing(table(['a', 'c']));
    expect(asked.pendingResponse).toMatchObject({
      respondingSeatId: 'a',
      allowedCardIds: ['counter'],
      reason: { kind: 'wuxie', toolUserSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, tool: { as: 'blessing' } },
    });
    const next = pass(asked); // a passes: c is asked about the same target
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
  });

  it('cancels the Tool for that target only', () => {
    let s = counterWith(playBlessing(table(['c']))); // c cancels the Blessing on b
    expect(hp(s).b).toBe(2);
    expect(s.pendingResponse).toBeNull(); // c has no counter left, so c and d are not asked
    expect(hp(s)).toEqual({ a: 2, b: 2, c: 3, d: 3 });
  });

  it('opens a counter-check from the seat after the counter’s player; a counter on a counter lets the Tool through', () => {
    let s = playBlessing(table(['b', 'd']));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b' }); // about the Blessing on b
    s = counterWith(s); // b cancels it
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie', wuxieSeatId: 'b' } });
    s = counterWith(s); // d cancels b's counter: the Blessing on b goes ahead
    expect(hp(s).b).toBe(3);
    const played = s.log.filter((e) => e.kind === 'CardPlayedEvent');
    expect(played[1]).toMatchObject({ seatId: 'b', inResponseTo: { seatId: 'a', cardInstanceId: 'bless', targetSeatId: 'b' } });
    expect(played[2]).toMatchObject({ seatId: 'd', inResponseTo: { seatId: 'b', counters: true } });
  });

  it('never asks the counter’s own player in its counter-check, and passing walks on without looping', () => {
    let s = counterWith(playBlessing(table(['a', 'b']))); // a cancels its own Blessing on b
    // Counter-check order is b, c, d: b holds a counter, a (the counter's player) is never asked.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'counter-wuxie', wuxieSeatId: 'a' } });
    s = pass(s); // nobody else holds one: a's counter stands
    expect(hp(s).b).toBe(2);
    // On to c: b is asked again (a has no counter left).
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'c' } } });
  });

  it('gives each window its own id, even when the same seat is asked twice with nothing logged between', () => {
    let s = counterWith(playBlessing(table(['c', 'd']))); // c cancels the Blessing on b
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie' } });
    const first = s.pendingResponse!.id;
    s = pass(s); // d lets c's counter stand; next, d is asked about the Blessing on c
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'c' } } });
    expect(s.pendingResponse!.id).not.toBe(first);
  });

  it('does nothing for a target eliminated before its turn comes (Review Focus 1)', () => {
    const s = table();
    const withCEliminatedLater = { ...s, seats: s.seats.map((x) => (x.id === 'c' ? { ...x, eliminated: true } : x)) };
    const next = resolve(
      {
        ...withCEliminatedLater,
        resolutionQueue: [
          { kind: 'ToolOnTargetEffect', tool: usedCardOf({ instanceId: 'bless', definitionId: 'blessing', suit: 'heart', rank: 1 }), userSeatId: 'a', target: { kind: 'seat', seatId: 'c' }, counterCardIds: ['counter'] },
        ],
        zones: s.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [] } : z)),
      },
      { kind: 'EndPhaseAction', seatId: 'a' },
      ctx
    ).state;
    expect(next.seats.find((x) => x.id === 'c')!.combinedHp).toBe(2);
    expect(next.log.some((e) => e.kind === 'HealEvent')).toBe(false);
  });
});
