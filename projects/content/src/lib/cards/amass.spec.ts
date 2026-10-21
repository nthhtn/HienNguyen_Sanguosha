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
const play = (s: GameState) => act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'am', targets: [] });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const select = (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids });
const hand = (s: GameState, seatId: string) => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards.map((c) => c.instanceId);
const am = card('am', 'amass', 'heart', 3);
const WEI_MATES: Kingdom[] = ['Wei', 'Shu', 'Wei', 'Qun'];

describe('Amass', () => {
  it('is a Tool, playable with no target', () => {
    expect(registry.cards.get('amass')).toMatchObject({ id: 'amass', category: 'tool', name: alternateCardData('amass')!.name });
  });

  it('each Kingdom mate in turn order draws 2 then discards 2, finishing before the next; others untouched', () => {
    let s = play(table(WEI_MATES, { 'seat-a:hand': [am], 'seat-c:hand': [card('c1', 'peach')] }));
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', min: 2, max: 2 });
    expect(hand(s, 'seat-a')).toHaveLength(2);
    expect(hand(s, 'seat-c')).toEqual(['c1']); // c has not drawn yet
    s = select(s, 'p0', 'p1');
    expect(hand(s, 'seat-a')).toHaveLength(0);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-c', min: 2, max: 2 });
    expect(hand(s, 'seat-c')).toHaveLength(3);
    s = select(s, 'c1', 'p2');
    expect(s.pendingSelection).toBeFalsy();
    expect(hand(s, 'seat-c')).toHaveLength(1);
    expect(hand(s, 'seat-b')).toEqual([]);
    expect(hand(s, 'seat-d')).toEqual([]);
    const draws = s.log.filter((e) => e.kind === 'CardsDrawnEvent' || e.kind === 'CardDrawnEvent');
    expect(draws.length).toBeGreaterThan(0);
  });

  it('with no exposed General it is still playable and targets the user alone', () => {
    const s0 = table(['hidden', 'hidden', 'hidden', 'hidden'], { 'seat-a:hand': [am] });
    expect(getLegalActions(s0, 'seat-a', registry).some((x) => x.kind === 'PlayCardAction' && x.cardInstanceId === 'am')).toBe(true);
    let s = play(s0);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a' });
    s = select(s, 'p0', 'p1');
    expect(s.pendingSelection).toBeFalsy();
    expect(hand(s, 'seat-b')).toEqual([]);
    expect(hand(s, 'seat-c')).toEqual([]);
  });

  it('a target cancelled by Wuxie is skipped, and the rest continue', () => {
    const kingdoms: Kingdom[] = ['Wei', 'Wei', 'Wei', 'Qun'];
    let s = play(table(kingdoms, { 'seat-a:hand': [am], 'seat-d:hand': [card('w1', 'wuxie')] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie', target: { seatId: 'seat-a' } } });
    s = pass(s);
    s = select(s, 'p0', 'p1'); // a finishes
    expect(s.pendingResponse).toMatchObject({ reason: { kind: 'wuxie', target: { seatId: 'seat-b' } } });
    s = respond(s, 'w1'); // cancels b
    expect(hand(s, 'seat-b')).toEqual([]);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-c' }); // d's Wuxie is spent, so c goes on
    expect(hand(s, 'seat-c')).toHaveLength(2);
  });

  it('a target that dies before its turn is skipped', () => {
    let s = play(table(WEI_MATES, { 'seat-a:hand': [am] }));
    s = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    s = select(s, 'p0', 'p1');
    expect(s.pendingSelection).toBeFalsy();
    expect(hand(s, 'seat-c')).toEqual([]);
  });

  it('a target holding fewer than 2 cards after drawing discards what it has', () => {
    let s = play(table(['Wei', 'Shu', 'Shu', 'Shu'], { 'seat-a:hand': [am], drawPile: [] }));
    // Only Amass itself is left to reshuffle from the discard pile.
    expect(hand(s, 'seat-a')).toHaveLength(1);
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 1, eligibleIds: hand(s, 'seat-a') });
    s = select(s, hand(s, 'seat-a')[0]);
    expect(hand(s, 'seat-a')).toEqual([]);
  });

  it('the discard may include equipment', () => {
    const s = play(table(['Wei', 'Shu', 'Shu', 'Shu'], { 'seat-a:hand': [am], 'seat-a:equip': [card('eq', 'axe')] }));
    expect(s.pendingSelection!.eligibleIds).toEqual(expect.arrayContaining(['eq', 'p0', 'p1']));
    const after = select(s, 'eq', 'p0');
    expect(after.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(expect.arrayContaining(['eq', 'p0']));
  });
});
