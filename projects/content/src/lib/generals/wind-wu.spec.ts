import type { Effect } from 'engine';
import { usedCardOf } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, seat, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const xiaoQiao: TableOptions['generals'] = { 'seat-a': ['xiao-qiao', 'sun-ce'] };
const zhouTai: TableOptions['generals'] = { 'seat-a': ['zhou-tai', 'sun-ce'] };
const hit = (amount: number, source: string | null = 'seat-b'): Effect => ({
  kind: 'DamageEffect', damage: { source: source ? seat(source) : null, target: seat('seat-a'), amount, nature: 'normal' },
});

describe('Xiao Qiao — Fantasy', () => {
  it('discards a heart card to move the damage to another seat, which then draws as many as it is missing HP', () => {
    let s = h.run(table({ 'seat-a:hand': [card('h', 'peach', 'heart')], drawPile: [card('d1', 'shan')] }, { generals: xiaoQiao }), [hit(1)]);
    expect(askedAbout(s)).toBe('fantasy');
    s = h.choose(h.select(h.use(s), 'h'), 'seat-c');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
  });

  it("Beauty: her spades count as hearts for Fantasy's cost", () => {
    const s = h.use(h.run(table({ 'seat-a:hand': [card('sp', 'sha', 'spade'), card('cl', 'sha', 'club')] }, { generals: xiaoQiao }), [hit(1)]));
    expect(s.pendingSelection?.eligibleIds).toEqual(['sp']);
  });

  it("Don't, or no heart: the damage is hers", () => {
    expect(hp(h.decline(h.run(table({ 'seat-a:hand': [card('h', 'peach', 'heart')] }, { generals: xiaoQiao }), [hit(1)])), 'seat-a')).toBe(3);
    expect(h.run(table({ 'seat-a:hand': [card('cl', 'sha', 'club')] }, { generals: xiaoQiao }), [hit(1)]).pendingChoice).toBeUndefined();
  });
});

describe('Xiao Qiao — Beauty and the delayed Tools', () => {
  const judgedOnHer = (tool: string, judged: ReturnType<typeof card>) =>
    kw.settle(table({ 'seat-a:judgment': [card('t', tool, 'spade', 1)], drawPile: [judged, ...Array.from({ length: 4 }, (_, i) => card(`f${i}`, 'shan', 'diamond'))] }, { generals: xiaoQiao, phase: 'Start' }));

  it('a spade judged for her Capture counts as a heart and spares her Play Phase', () => {
    const s = judgedOnHer('capture', card('j', 'sha', 'spade', 9));
    expect(s.phase).toBe('Play');
    expect(s.turn.ownerSeatId).toBe('seat-a');
  });

  it('a spade 5 judged for her Lightning counts as a heart: no strike', () => {
    expect(hp(judgedOnHer('lightning', card('j', 'sha', 'spade', 5)), 'seat-a')).toBe(4);
  });
});

describe('Zhou Tai — Refusing Death', () => {
  const zt = (drawPile: ReturnType<typeof card>[]) => table({ drawPile }, { generals: zhouTai, hp: { 'seat-a': 1 } });

  it('from 1 HP to -1: two cards turned, each asked; no match, so he stays alive with no dying round', () => {
    let s = kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'shan', 'heart', 7)]), [hit(2)]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(hp(s, 'seat-a')).toBe(-1);
    expect(s.seats[0].eliminated).toBe(false);
    expect(s.pendingResponse).toBeNull();
    expect(ids(s, 'seat-a:pile')).toEqual(['r1', 'r2']);
    expect(abilityLog(s).at(-1)).toMatchObject({ abilityId: 'refusing-death', outcome: 'stays-alive' });
  });

  it('a later hit of 1 turns one more card', () => {
    let s = kw.use(kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'shan', 'heart', 7), card('r3', 'shan', 'heart', 9)]), [hit(2)])));
    s = kw.run(s, [hit(1)]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(ids(s, 'seat-a:pile')).toEqual(['r1', 'r2', 'r3']);
    expect(hp(s, 'seat-a')).toBe(-2);
  });

  it('a matching rank: the dying round goes ahead', () => {
    const s = kw.use(kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'sha', 'spade', 5)]), [hit(2)])));
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
    expect(abilityLog(s).at(-1)).toMatchObject({ outcome: 'matched' });
  });

  it("Don't: the dying round goes ahead", () => {
    expect(kw.decline(kw.run(zt([card('r1', 'shan', 'heart', 5)]), [hit(1)])).pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
  });

  it('each time he recovers HP, he may discard one of the cards', () => {
    let s = kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5)]), [hit(1)]));
    s = kw.run(s, [{ kind: 'HealEffect', target: seat('seat-a'), amount: 1 }]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.select(kw.use(s), 'r1');
    expect(ids(s, 'seat-a:pile')).toEqual([]);
    expect(ids(s, 'discardPile')).toContain('r1');
  });
});

describe('Fantasy after another before-damage skill (final review #1)', () => {
  // Xu Chu (seat-a, Bare the Chest used) hits Xiao Qiao (seat-b) with a Sha; Bare the Chest is asked first by seat order.
  const hit = () =>
    h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('h', 'peach', 'heart')] }, { generals: { 'seat-a': ['xu-chu', 'zhang-he'], 'seat-b': ['xiao-qiao', 'sun-ce'] }, flags: { 'bare-the-chest': true } }), 's1', 'seat-b'));

  it('Bare the Chest adds its 1 once, whether she declines or moves the damage', () => {
    const asked = hit();
    expect(askedAbout(asked)).toBe('fantasy');
    expect(hp(h.decline(asked), 'seat-b')).toBe(2);
    expect(hp(h.choose(h.select(h.use(asked), 'h'), 'seat-c'), 'seat-c')).toBe(2);
  });
});

describe('Refusing Death with an empty draw pile (final review #6)', () => {
  it('shuffles the discard pile in to turn its card, as a draw would', () => {
    let s = kw.run(table({ discardPile: [card('r1', 'shan', 'heart', 5)] }, { generals: zhouTai, hp: { 'seat-a': 1 } }), [hit(1)]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(ids(s, 'seat-a:pile')).toEqual(['r1']);
    expect(s.pendingResponse).toBeNull();
  });
});
