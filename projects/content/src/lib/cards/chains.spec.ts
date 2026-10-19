import type { GameState } from 'engine';
import { isChained } from 'engine';
import { card, handIds, harness, ids, registry, table, TableOptions } from '../generals/skills.testing';

// Chains (spec "Chains"): a Tool at 1 or 2 living seats at any distance, each
// toggling in turn after its own Wuxie check; or Recast: discard it, draw 1.
const { legal, play, pass, respond } = harness();
const chainsIn = (o: TableOptions = {}, more: Record<string, ReturnType<typeof card>[]> = {}) =>
  table({ 'seat-a:hand': [card('ch', 'chains', 'club', 10)], drawPile: [card('d1', 'shan', 'heart', 1), card('d2', 'shan', 'heart', 2)], ...more }, o);
const chain = (s: GameState, ...seatIds: string[]): GameState => ({ ...s, seats: s.seats.map((x) => (seatIds.includes(x.id) ? { ...x, chained: true as const } : x)) });
const offers = (s: GameState, cardId = 'ch') => legal(s, 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === cardId);
// The seats Chains may pick (its Choose Targets template), or null without one.
const pickOf = (s: GameState) => {
  const template = offers(s).find((a) => a.kind === 'PlayCardAction' && a.pickTargets);
  return template?.kind === 'PlayCardAction' ? template.pickTargets ?? null : null;
};
const toggles = (s: GameState) => s.log.flatMap((e) => (e.kind === 'ChainToggledEvent' ? [[e.seatId, e.chained]] : []));
const chained = (s: GameState) => s.seats.filter((x) => isChained(s, x.id)).map((x) => x.id);

describe('Chains', () => {
  it('is a registered Tool', () => {
    expect(registry.cards.get('chains')).toMatchObject({ id: 'chains', name: 'Chains', category: 'tool' });
  });

  it('offers a pick of 1 or 2 living seats (the user too, at any distance, in turn order from the user) and the Recast', () => {
    const s = chainsIn({ seats: 5 });
    expect(offers(s)).toEqual([
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'ch', targets: [], pickTargets: { eligibleIds: ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'], min: 1, max: 2 } },
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'ch', targets: [] },
    ]);
  });

  it('accepts any 1 or 2 distinct eligible seats, and refuses the same seat twice or 3 seats', () => {
    const s = chainsIn();
    expect(() => play(s, 'ch', 'seat-d')).not.toThrow();
    expect(() => play(s, 'ch', 'seat-a', 'seat-d')).not.toThrow();
    expect(() => play(s, 'ch', 'seat-b', 'seat-b')).toThrow();
    expect(() => play(s, 'ch', 'seat-b', 'seat-c', 'seat-d')).toThrow();
  });

  it('with a single eligible seat: no pick, that seat alone and the Recast', () => {
    const s = chainsIn({ seats: 2, generals: { 'seat-b': ['jia-xu', 'filler-dong-zhuo'] } });
    expect(pickOf(s)).toBeNull();
    expect(offers(s).map((a) => (a.kind === 'PlayCardAction' ? a.targets : null))).toEqual([[], [{ kind: 'seat', seatId: 'seat-a' }]]);
  });

  it('toggles in turn order from the user, whatever order the seats were picked in', () => {
    const s = play(chainsIn(), 'ch', 'seat-c', 'seat-b');
    expect(toggles(s)).toEqual([['seat-b', true], ['seat-c', true]]);
  });

  it('leaves out dead seats, and keeps a seat whose Generals are hidden', () => {
    const t = chainsIn({ generals: { 'seat-c': ['filler-xu-huang', 'filler-dong-zhuo', false] } });
    const s: GameState = { ...t, seats: t.seats.map((x) => (x.id === 'seat-d' ? { ...x, eliminated: true } : x)) };
    expect(pickOf(s)?.eligibleIds).toEqual(['seat-a', 'seat-b', 'seat-c']);
  });

  it('leaves out a seat that cannot be targeted by it (Curtain: a black Tool)', () => {
    const s = chainsIn({ generals: { 'seat-b': ['jia-xu', 'filler-dong-zhuo'] } });
    expect(pickOf(s)?.eligibleIds).toEqual(['seat-a', 'seat-c', 'seat-d']);
    expect(() => play(s, 'ch', 'seat-b')).toThrow();
  });

  it('toggles each target in turn: unchained becomes chained, chained becomes unchained', () => {
    const s = play(chain(chainsIn(), 'seat-c'), 'ch', 'seat-b', 'seat-c');
    expect(s.pendingResponse).toBeNull();
    expect(chained(s)).toEqual(['seat-b']);
    expect(toggles(s)).toEqual([['seat-b', true], ['seat-c', false]]);
    expect(ids(s, 'discardPile')).toEqual(['ch']);
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('a single target toggles alone; the user may chain itself', () => {
    const s = play(chainsIn(), 'ch', 'seat-a');
    expect(chained(s)).toEqual(['seat-a']);
    expect(toggles(s)).toEqual([['seat-a', true]]);
  });

  it('a Wuxie on one target cancels only that target’s toggle', () => {
    let s = play(chainsIn({}, { 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'ch', 'seat-b', 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'seat-b' } } });
    s = respond(s, 'w');
    while (s.pendingResponse) s = pass(s);
    expect(chained(s)).toEqual(['seat-c']);
    expect(toggles(s)).toEqual([['seat-c', true]]);
  });

  it('a Wuxie on the second target cancels only that target’s toggle', () => {
    let s = play(chainsIn({}, { 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'ch', 'seat-b', 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'seat-b' } } });
    s = pass(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'seat-c' } } });
    s = respond(s, 'w');
    while (s.pendingResponse) s = pass(s);
    expect(chained(s)).toEqual(['seat-b']);
    expect(toggles(s)).toEqual([['seat-b', true]]);
  });

  it('a target that dies before its toggle is skipped, without a throw', () => {
    let s = play(chainsIn({}, { 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'ch', 'seat-b', 'seat-c');
    expect(s.pendingResponse).toMatchObject({ reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'seat-b' } } });
    // seat-c dies while the first target's Wuxie check is open.
    s = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    expect(() => {
      s = pass(s);
      while (s.pendingResponse) s = pass(s);
    }).not.toThrow();
    expect(chained(s)).toEqual(['seat-b']);
    expect(toggles(s)).toEqual([['seat-b', true]]);
    expect(s.seats.find((x) => x.id === 'seat-c')!.chained).toBeFalsy();
  });

  it('a target passed by every Wuxie holder toggles', () => {
    let s = play(chainsIn({}, { 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'ch', 'seat-b');
    while (s.pendingResponse) s = pass(s);
    expect(chained(s)).toEqual(['seat-b']);
    expect(handIds(s, 'seat-d')).toEqual(['w']);
  });

  it('Recast: discards Chains and draws 1, toggling nobody and opening no Wuxie check', () => {
    const s = play(chainsIn({}, { 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'ch');
    expect(s.pendingResponse).toBeNull();
    expect(ids(s, 'discardPile')).toEqual(['ch']);
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(toggles(s)).toEqual([]);
  });

  it('Recast with an empty draw pile: the discard pile (Chains included) is reshuffled for the draw', () => {
    const s = play(table({ 'seat-a:hand': [card('ch', 'chains', 'club', 10)], drawPile: [], discardPile: [card('x', 'shan', 'heart', 3)] }), 'ch');
    expect(s.log.some((e) => e.kind === 'DiscardPileReshuffledEvent')).toBe(true);
    expect(handIds(s, 'seat-a')).toHaveLength(1);
    // A reshuffle gives the cards new instance ids; the two cards are still there.
    const defs = ['seat-a:hand', 'drawPile', 'discardPile'].flatMap((id) => s.zones.find((z) => z.id === id)!.cards.map((c) => c.definitionId));
    expect(defs.sort()).toEqual(['chains', 'shan']);
  });
});
