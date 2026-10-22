import { card, handIds, harness, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const pile = Array.from({ length: 12 }, (_, i) => card(`d${i}`, 'shan', 'spade'));
const hit = (amount: number) => [
  { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
];
const xunYu = (general: string, own: Record<string, ReturnType<typeof card>[]> = {}, maxHp: Record<string, number> = {}) =>
  table({ drawPile: pile, ...own }, { generals: at('seat-a', general), maxHp });

describe('Alternate Xun Yu, Eternal Loyalty', () => {
  it('draws up to a max HP of 4 (3 cards from 1)', () => {
    let s = h.run(xunYu('alternate:xun-yu', { 'seat-b:hand': [card('x', 'shan')] }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(4);
  });

  it('never draws above 5 cards with a max HP of 6', () => {
    let s = h.run(xunYu('alternate:xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
  });

  it('draws nothing when the hand is already at 5 with a max HP of 6', () => {
    const five = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan', 'heart'));
    let s = h.run(xunYu('alternate:xun-yu', { 'seat-b:hand': five }, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    expect(s.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
  });

  it('asks once per point of damage', () => {
    let s = h.run(xunYu('alternate:xun-yu', {}, { 'seat-b': 6, 'seat-c': 6 }), hit(2));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    s = h.choose(h.use(s), 'seat-c');
    expect(handIds(s, 'seat-c')).toHaveLength(5);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('leaves Default Xun Yu drawing to a max HP of 6', () => {
    let s = h.run(xunYu('xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(6);
  });
});
