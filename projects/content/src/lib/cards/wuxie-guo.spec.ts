import { getLegalActions, resolve } from 'engine';
import type { CardDefinition, ContentRegistry, GameModeDefinition, GameState, Kingdom } from 'engine';
import { wuxieCard } from './wuxie';
import { wuxieGuoCard } from './wuxie-guo';
import { peachGardenCard } from './peach-garden';
import { COUNTER_CARD_IDS } from '../shared/tools';

const registry: ContentRegistry = {
  cards: new Map(([wuxieCard, wuxieGuoCard, peachGardenCard] as CardDefinition[]).map((c) => [c.id, c])),
  generals: new Map(),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

type SeatId = 'a' | 'b' | 'c' | 'd';
const ids: SeatId[] = ['a', 'b', 'c', 'd'];

// Four hurt seats (2/4 HP). a holds Peach Garden; `hands` lists each seat's counter cards.
function table(kingdoms: Record<SeatId, Kingdom>, hands: Partial<Record<SeatId, string[]>>): GameState {
  return {
    seats: ids.map((id, index) => {
      const revealed = kingdoms[id] !== 'hidden';
      return {
        id, index, kingdom: kingdoms[id], combinedHp: 2, maxCombinedHp: 4, eliminated: false,
        generals: { main: { generalDefinitionId: `${id}1`, revealed }, deputy: { generalDefinitionId: `${id}2`, revealed } },
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        {
          id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id,
          cards: [
            ...(id === 'a' ? [{ instanceId: 'garden', definitionId: 'peach-garden', suit: 'heart' as const, rank: 1 }] : []),
            ...(hands[id] ?? []).map((cardId) => ({ instanceId: `${id}-${cardId}`, definitionId: cardId, suit: 'club' as const, rank: 13 })),
          ],
        },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const play = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'garden', targets: [] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const answer = (s: GameState, cardId: string) => {
  const seatId = s.pendingResponse!.respondingSeatId;
  return resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId: `${seatId}-${cardId}` }, ctx).state;
};
const offered = (s: GameState) =>
  getLegalActions(s, s.pendingResponse!.respondingSeatId, registry)
    .filter((x): x is Extract<typeof x, { kind: 'RespondAction' }> => x.kind === 'RespondAction')
    .map((x) => x.cardInstanceId);
const hp = (s: GameState) => Object.fromEntries(s.seats.map((x) => [x.id, x.combinedHp]));
const allWei: Record<SeatId, Kingdom> = { a: 'Wei', b: 'Wei', c: 'Wei', d: 'Qun' };

describe('Wuxie Kingdom', () => {
  it('is a response-only Tool, among the counter cards', () => {
    expect(wuxieGuoCard).toMatchObject({ id: 'wuxie-guo', name: 'Wuxie Kingdom', category: 'tool' });
    expect(COUNTER_CARD_IDS).toEqual(['wuxie', 'wuxie-guo']);
    const s = table(allWei, { a: ['wuxie-guo'] });
    expect(getLegalActions(s, 'a', registry).some((x) => x.kind === 'PlayCardAction' && x.cardInstanceId === 'a-wuxie-guo')).toBe(false);
  });

  it('is offered against a Tool on a player whose General is exposed', () => {
    const s = play(table(allWei, { b: ['wuxie-guo'] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['wuxie', 'wuxie-guo'], reason: { kind: 'wuxie', target: { seatId: 'a' } } });
    expect(offered(s)).toEqual(['b-wuxie-guo']);
  });

  it('is not offered against a player whose Generals are both hidden', () => {
    const hiddenA = { ...allWei, a: 'hidden' as const };
    // Holding only Wuxie Kingdom, b is not asked about a at all.
    expect(play(table(hiddenA, { b: ['wuxie-guo'] })).pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { seatId: 'b' } } });
    // Holding both, only the Wuxie is offered about a.
    const s = play(table(hiddenA, { b: ['wuxie', 'wuxie-guo'] }));
    expect(s.pendingResponse).toMatchObject({ reason: { kind: 'wuxie', target: { seatId: 'a' } } });
    expect(offered(s)).toEqual(['b-wuxie']);
    expect(() => answer(s, 'wuxie-guo')).toThrow();
  });

  it('cancels the Tool for every player of that Kingdom it has not yet affected', () => {
    let s = play(table(allWei, { b: ['wuxie-guo'] }));
    s = answer(s, 'wuxie-guo'); // about a (Wei): a, b and c are spared, Qun d recovers
    expect(hp(s)).toEqual({ a: 2, b: 2, c: 2, d: 3 });
    expect(s.pendingResponse).toBeNull();
    expect(s.toolCancellations ?? []).toEqual([]);
  });

  it('still affects a later target whose Generals are both hidden (Review Focus 1)', () => {
    // Order a (Wei), b (hidden), c (Wei), d (Qun): cancelling Wei on a skips c, not hidden b.
    let s = play(table({ a: 'Wei', b: 'hidden', c: 'Wei', d: 'Qun' }, { b: ['wuxie-guo'] }));
    s = answer(s, 'wuxie-guo');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s)).toEqual({ a: 2, b: 3, c: 2, d: 3 });
  });

  it('is answered by a Wuxie, which keeps the Tool for the whole Kingdom', () => {
    let s = play(table(allWei, { b: ['wuxie-guo'], c: ['wuxie'] }));
    s = answer(s, 'wuxie-guo');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'counter-wuxie', wuxieSeatId: 'b' } });
    expect(offered(s)).toEqual(['c-wuxie']);
    s = answer(s, 'wuxie');
    expect(hp(s)).toEqual({ a: 3, b: 3, c: 3, d: 3 });
  });

  it('answers a Wuxie as a plain Wuxie, cancelling no Kingdom', () => {
    let s = play(table(allWei, { b: ['wuxie'], c: ['wuxie-guo'] }));
    s = answer(s, 'wuxie'); // b cancels Peach Garden on a
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'counter-wuxie', wuxieSeatId: 'b' } });
    expect(offered(s)).toEqual(['c-wuxie-guo']);
    s = answer(s, 'wuxie-guo'); // c cancels that Wuxie: a recovers, and Wei b and c are not cancelled
    expect(hp(s)).toEqual({ a: 3, b: 3, c: 3, d: 3 });
  });
});
