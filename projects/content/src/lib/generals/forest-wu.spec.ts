import { redactStateForSeat } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const cards = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));

describe('Sun Jian — Brave Spirit', () => {
  // seat-d's turn ends; seat-a's Start Phase comes.
  const starting = (o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.settle(table({ drawPile: cards('d', 6), ...extra }, { generals: at('seat-a', 'sun-jian'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 1 }, ...o }));

  it('at the start of his turn, if damaged, the seat he picks draws X and discards 1, or draws 1 and discards X, as he chooses', () => {
    let s = starting(); // X = 3
    expect(askedAbout(s)).toBe('brave-spirit');
    s = h.choose(h.use(s), 'seat-b');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', reason: { targetSeatId: 'seat-b' } }); // the owner chooses the mode
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Draw 3, Then Discard 1' }, { kind: 'label', text: 'Draw 1, Then Discard 3' }]);
    s = h.choose(s, 'draw-x');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', min: 1, max: 1 });
    s = h.select(s, 'd1');
    expect(handIds(s, 'seat-b')).toEqual(['d2', 'd3']);
    expect(ids(s, 'discardPile')).toEqual(['d1']);
  });

  it('he may pick himself and still chooses the mode', () => {
    let s = h.choose(h.use(starting()), 'seat-a');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', reason: { targetSeatId: 'seat-a' } });
    s = h.choose(s, 'draw-x');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a' });
  });

  it('the other option: draw 1, discard X (at most what the seat holds)', () => {
    let s = h.choose(h.choose(h.use(starting()), 'seat-b'), 'draw-1');
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 1 }); // only 1 card held
    s = h.select(s, 'd1');
    expect(handIds(s, 'seat-b')).toEqual([]);
  });

  it('he may pick himself', () => {
    const s = h.use(starting());
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
  });

  it('is not asked at full HP, and Don’t does nothing', () => {
    expect(askedAbout(starting({ hp: { 'seat-a': 4 } }))).toBeNull();
    expect(handIds(h.decline(starting()), 'seat-b')).toEqual([]);
  });
});

describe('Lu Su — Charity', () => {
  const drawing = (hand: number, o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.run(table({ 'seat-a:hand': cards('a', hand), drawPile: cards('d', 6), ...extra }, { generals: at('seat-a', 'lu-su'), ...o }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);

  it('draws 2 extra; with more than 5 cards he gives half (rounded down) to the seat with fewest hand cards', () => {
    let s = drawing(2, {}, { 'seat-c:hand': cards('c', 1), 'seat-d:hand': cards('e', 2) }); // 2 + 4 = 6 cards
    expect(askedAbout(s)).toBe('charity');
    s = h.use(s);
    expect(s.pendingSelection).toMatchObject({ min: 3, max: 3, seatId: 'seat-a' });
    s = h.select(s, 'a1', 'a2', 'd1');
    expect(handIds(s, 'seat-a')).toHaveLength(3);
    expect(handIds(s, 'seat-b')).toEqual(['a1', 'a2', 'd1']); // seat-b holds 0
  });

  it('exactly 5 cards: nothing is given (Review Focus 3)', () => {
    const s = h.use(drawing(1));
    expect(s.pendingSelection).toBeUndefined();
    expect(handIds(s, 'seat-a')).toHaveLength(5);
  });

  it('a tie for fewest hand cards: he chooses who gets them', () => {
    let s = h.select(h.use(drawing(2)), 'a1', 'a2', 'd1'); // seat-b, seat-c and seat-d all hold 0
    expect(s.pendingChoice).toMatchObject({ verb: 'give', seatId: 'seat-a' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['a1', 'a2', 'd1']);
  });

  it("Don't draws just 2", () => {
    expect(handIds(h.decline(drawing(2)), 'seat-a')).toHaveLength(4);
  });
});

describe('Lu Su — Alliance', () => {
  const tableOf = (aCards: number, bCards: number, cCards: number, dCards = cCards, o: TableOptions = {}) =>
    table({ 'seat-a:hand': cards('a', aCards), 'seat-b:hand': cards('b', bCards), 'seat-c:hand': cards('c', cCards), 'seat-d:hand': cards('e', dCards) }, { generals: at('seat-a', 'lu-su'), ...o });
  const offered = (s: ReturnType<typeof tableOf>) => h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === 'alliance');

  it('two other seats swap hands, and he discards as many cards as the difference', () => {
    let s = h.useSkill(tableOf(3, 4, 1), 'seat-a', 'alliance');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', min: 1, max: 1 });
    s = h.select(s, 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d', 'cancel']);
    s = h.choose(s, 'seat-c');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', min: 3, max: 3 });
    s = h.select(s, 'a1', 'a2', 'a3');
    expect(ids(s, 'discardPile')).toEqual(['a1', 'a2', 'a3']);
    expect(handIds(s, 'seat-b')).toEqual(['c1']);
    expect(handIds(s, 'seat-c')).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('equal hands are never offered as a pair (Review Focus 4)', () => {
    let s = h.useSkill(tableOf(3, 4, 1, 4), 'seat-a', 'alliance');
    s = h.select(s, 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'cancel']); // seat-d holds 4 as well
  });

  it('a pair that costs more than he holds is not offered', () => {
    expect(offered(tableOf(2, 4, 1))).toBe(false); // cost 3, he holds 2
    expect(offered(tableOf(3, 4, 1))).toBe(true);
  });

  it('his equipment pays too', () => {
    const base = tableOf(1, 4, 1, 1);
    const withGear = { ...base, zones: base.zones.map((z) => (z.id === 'seat-a:equip' ? { ...z, cards: [card('g1', 'crossbow', 'club', 1), card('g2', 'silver-lion', 'club', 1)] } : z)) };
    let t = h.select(h.useSkill(withGear, 'seat-a', 'alliance'), 'seat-b');
    t = h.choose(t, 'seat-c');
    expect(t.pendingSelection!.eligibleIds).toEqual(['a1', 'g1', 'g2']);
    t = h.select(t, 'g1', 'g2', 'a1');
    expect(handIds(t, 'seat-b')).toEqual(['c1']);
  });

  it('once per turn', () => {
    const fresh = tableOf(8, 4, 1);
    let t = h.select(h.useSkill(fresh, 'seat-a', 'alliance'), 'seat-b');
    t = h.select(h.choose(t, 'seat-c'), 'a1', 'a2', 'a3');
    expect(offered(fresh)).toBe(true);
    expect(offered(t)).toBe(false); // five cards left, and pairs he could pay for, but the use is spent
  });

  it('cancelling the first pick costs nothing', () => {
    const s = h.cancel(h.useSkill(tableOf(3, 4, 1), 'seat-a', 'alliance'));
    expect(offered(s)).toBe(true);
  });

  const key = 'seat-a/main/alliance';
  const uses = (s: ReturnType<typeof tableOf>) => s.turn.abilityUses?.[key] ?? 0;

  it('cancelling at the second pick refunds the use', () => {
    let s = h.select(h.useSkill(tableOf(3, 4, 1), 'seat-a', 'alliance'), 'seat-b');
    expect(uses(s)).toBe(1);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d', 'cancel']);
    s = h.choose(s, 'cancel');
    expect(s.pendingChoice).toBeUndefined();
    expect(uses(s)).toBe(0);
    expect(offered(s)).toBe(true);
  });

  it('cancelling the discard selection refunds the use and swaps nothing', () => {
    const start = tableOf(3, 4, 1);
    let s = h.choose(h.select(h.useSkill(start, 'seat-a', 'alliance'), 'seat-b'), 'seat-c');
    s = h.cancel(s);
    expect(uses(s)).toBe(0);
    expect(offered(s)).toBe(true);
    expect(handIds(s, 'seat-a')).toEqual(handIds(start, 'seat-a'));
    expect(handIds(s, 'seat-b')).toEqual(handIds(start, 'seat-b'));
    expect(handIds(s, 'seat-c')).toEqual(handIds(start, 'seat-c'));
  });

  it('the General stays revealed after a cancel', () => {
    const start = tableOf(3, 4, 1, 4, { generals: { 'seat-a': ['lu-su', 'filler-jiang-wei', false] } });
    expect(start.seats.find((x) => x.id === 'seat-a')!.generals.main.revealed).toBe(false);
    const s = h.choose(h.select(h.useSkill(start, 'seat-a', 'alliance'), 'seat-b'), 'cancel');
    expect(s.seats.find((x) => x.id === 'seat-a')!.generals.main.revealed).toBe(true);
    expect(uses(s)).toBe(0);
  });

  it('a hidden Lu Su cancelling at the second pick shows a bystander no hand card, before or after', () => {
    const start = tableOf(3, 4, 1, 4, { generals: { 'seat-a': ['lu-su', 'filler-jiang-wei', false] } });
    // Seat-d sees the hands of seats a, b and c only as hidden cards, and never the deputy.
    const clean = (s: typeof start) => {
      const view = redactStateForSeat(s, 'seat-d');
      for (const id of ['seat-a', 'seat-b', 'seat-c']) expect(view.zones.find((z) => z.id === `${id}:hand`)!.cards.every((c) => c.definitionId === 'hidden')).toBe(true);
      expect(JSON.stringify(view)).not.toContain('filler-jiang-wei');
    };
    const picked = h.select(h.useSkill(start, 'seat-a', 'alliance'), 'seat-b');
    clean(picked);
    const cancelled = h.choose(picked, 'cancel');
    clean(cancelled);
    expect(uses(cancelled)).toBe(0);
  });
});
