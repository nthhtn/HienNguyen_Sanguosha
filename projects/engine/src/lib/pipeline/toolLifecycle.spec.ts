import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { usedCardOf } from '../domain/usedCard';
import { livingSeatOrderFrom } from '../rules/seatOrder';
import { getLegalActions } from '../rules/legality';

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
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
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

// A Kingdom counter (the engine's view of Wuxie Kingdom): answers a Tool only
// when the seat it is aimed at has an exposed Kingdom, and then cancels the
// Tool for that Kingdom; on a counter it acts as a plain counter.
describe('a Kingdom cancel (CancelToolForKingdomEffect)', () => {
  const targetSeatOf = (pending: { reason?: { kind: string } } | undefined) => {
    const reason = pending?.reason as { kind: string; target?: { seatId: string } } | undefined;
    return reason?.kind === 'wuxie' ? reason.target!.seatId : null;
  };
  const kcounter: CardDefinition = {
    id: 'kcounter',
    name: 'Kingdom Counter',
    category: 'tool',
    legalPlayTargets: () => [],
    answerCondition: (state, pending) => {
      const seatId = targetSeatOf(pending);
      if (seatId === null) return true;
      return state.seats.find((s) => s.id === seatId)!.kingdom !== 'hidden';
    },
    play: (state, ctx) => {
      const reason = ctx.answering?.reason;
      if (reason?.kind !== 'wuxie') return [];
      const kingdom = state.seats.find((s) => s.id === reason.target.seatId)!.kingdom;
      if (kingdom === 'hidden') return [];
      return [{ kind: 'CancelToolForKingdomEffect', tool: reason.tool, kingdom, targetSeatId: reason.target.seatId }];
    },
  };
  const kctx = {
    registry: { cards: new Map([[blessing.id, blessing], [counter.id, counter], [kcounter.id, kcounter]]), generals: new Map() } as ContentRegistry,
    mode,
  };
  const counterIds = ['counter', 'kcounter'];
  const kBlessing: CardDefinition = {
    ...blessing,
    play: (state, ctx) =>
      (blessing.play(state, ctx, kctx.registry) as { counterCardIds: string[] }[]).map((e) => ({ ...e, counterCardIds: counterIds })),
  };
  kctx.registry.cards.set(kBlessing.id, kBlessing);

  // a Shu (the user), then b, c, d with the given Kingdoms; `hands` lists each seat's counter cards.
  function kingdoms(of: Record<'b' | 'c' | 'd', 'Wei' | 'Qun' | 'hidden'>, hands: Partial<Record<'a' | 'b' | 'c' | 'd', string[]>>): GameState {
    const s = table();
    return {
      ...s,
      seats: s.seats.map((x) => {
        const kingdom = x.id === 'a' ? 'Shu' : of[x.id as 'b' | 'c' | 'd'];
        const revealed = kingdom !== 'hidden';
        return { ...x, kingdom, generals: { main: { ...x.generals!.main, revealed }, deputy: { ...x.generals!.deputy!, revealed } } };
      }),
      zones: s.zones.map((z) => {
        const owner = z.ownerSeatId as 'a' | 'b' | 'c' | 'd' | undefined;
        if (z.kind !== 'hand' || !owner) return z;
        const extra = (hands[owner] ?? []).map((id) => ({ instanceId: `${owner}-${id}`, definitionId: id, suit: 'spade' as const, rank: 11 }));
        return { ...z, cards: [...z.cards, ...extra] };
      }),
    };
  }
  const play = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'bless', targets: [] }, kctx).state;
  const kpass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, kctx).state;
  const answer = (s: GameState, cardId: string) => {
    const seatId = s.pendingResponse!.respondingSeatId;
    return resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId: `${seatId}-${cardId}` }, kctx).state;
  };

  it('skips, with no check, every later target of the cancelled Kingdom; another Kingdom is still checked and affected', () => {
    let s = play(kingdoms({ b: 'Wei', c: 'Wei', d: 'Qun' }, { a: ['kcounter'], d: ['counter'] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'a', reason: { kind: 'wuxie', target: { seatId: 'b' } } });
    s = answer(s, 'kcounter'); // a cancels the Blessing for Wei
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie', wuxieSeatId: 'a' } });
    s = kpass(s); // the Kingdom cancel stands; c (Wei) is skipped, so d is next asked about d
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'wuxie', target: { seatId: 'd' } } });
    s = kpass(s);
    expect(hp(s)).toEqual({ a: 2, b: 2, c: 2, d: 3 });
    expect(s.toolCancellations ?? []).toEqual([]); // cleared once the Tool is resolved
  });

  it('still affects a target with both Generals hidden, and never offers the Kingdom cancel against one (Review Focus 1)', () => {
    // b hidden: a holds only the Kingdom counter, so a is not asked about b at all.
    let s = play(kingdoms({ b: 'hidden', c: 'Wei', d: 'Qun' }, { a: ['kcounter'] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'a', reason: { kind: 'wuxie', target: { seatId: 'c' } } });
    // With a plain counter too, only the plain one is offered about hidden b.
    s = play(kingdoms({ b: 'hidden', c: 'Wei', d: 'Qun' }, { a: ['kcounter', 'counter'] }));
    expect(targetSeatOf(s.pendingResponse!)).toBe('b');
    const offered = getLegalActions(s, 'a', kctx.registry).filter((x) => x.kind === 'RespondAction').map((x) => (x as { cardInstanceId: string }).cardInstanceId);
    expect(offered).toEqual(['a-counter']);
    expect(() => answer(s, 'kcounter')).toThrow();
    // Cancelling Wei on c leaves hidden b (already healed) and Qun d alone.
    s = kpass(s);
    s = answer(s, 'kcounter');
    expect(targetSeatOf(s.pendingResponse!)).toBe('d'); // a, still holding a counter, is asked about Qun d
    s = kpass(s);
    expect(hp(s)).toEqual({ a: 2, b: 3, c: 2, d: 3 });
  });

  it('reads the Kingdom live: a seat that reveals as the cancelled Kingdom before its turn is skipped too (Decided)', () => {
    let s = play(kingdoms({ b: 'Wei', c: 'hidden', d: 'Qun' }, { a: ['kcounter'], d: ['counter'] }));
    s = answer(s, 'kcounter'); // Wei cancelled; d is asked whether to counter it
    s = { ...s, seats: s.seats.map((x) => (x.id === 'c' ? { ...x, kingdom: 'Wei' as const, generals: { ...x.generals!, main: { ...x.generals!.main, revealed: true } } } : x)) };
    s = kpass(s);
    s = kpass(s); // d about d
    expect(hp(s)).toEqual({ a: 2, b: 2, c: 2, d: 3 });
  });

  it('cancels nothing more when the Kingdom cancel is itself countered', () => {
    let s = play(kingdoms({ b: 'Wei', c: 'Wei', d: 'Qun' }, { a: ['kcounter'], d: ['counter'] }));
    s = answer(s, 'kcounter');
    s = answer(s, 'counter'); // d counters it: the Blessing on b goes ahead, and c is not cancelled
    expect(hp(s)).toEqual({ a: 2, b: 3, c: 3, d: 3 });
    expect(s.toolCancellations ?? []).toEqual([]);
  });

  it('acts as a plain counter when it answers a counter: no Kingdom is cancelled', () => {
    let s = play(kingdoms({ b: 'Wei', c: 'Wei', d: 'Qun' }, { b: ['counter'], c: ['kcounter'] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b' });
    s = answer(s, 'counter'); // b cancels the Blessing on b
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'counter-wuxie', wuxieSeatId: 'b' } });
    s = answer(s, 'kcounter'); // c cancels b's counter
    expect(hp(s)).toEqual({ a: 2, b: 3, c: 3, d: 3 });
  });
});
