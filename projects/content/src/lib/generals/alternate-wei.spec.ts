import type { GameState } from 'engine';
import { redactStateForSeat } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, ids, table, TableOptions } from './skills.testing';

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

describe('Alternate Guo Jia, Bequeathed Strategy', () => {
  const id = 'alternate:bequeathed-strategy';
  const top = Array.from({ length: 8 }, (_, i) => card(`p${i}`, 'shan', 'heart', i + 1));
  const guoJia = (general: string, drawPile = top) => table({ drawPile }, { generals: at('seat-a', general) });
  const dmg = (amount: number) => [
    { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
  ];
  const pileIds = (s: GameState) => ids(s, 'drawPile');

  it('asks per point; Use shows only him the top 2 cards (no draw), then he gives one to B and the other to himself', () => {
    let s = h.run(guoJia('alternate:guo-jia'), dmg(1));
    expect(askedAbout(s)).toBe(id);
    s = h.use(s);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(pileIds(s).slice(0, 2)).toEqual(['p0', 'p1']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['p0', 'p1']);
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'card', card: top[0] }, { kind: 'card', card: top[1] }]);
    s = h.choose(s, 'p1');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['p1']);
    // The remaining card goes to a seat of his choice, himself included.
    expect(s.pendingChoice!.options.map((o) => o.id)).toContain('seat-a');
    s = h.choose(s, 'seat-a');
    expect(handIds(s, 'seat-a')).toEqual(['p0']);
    expect(pileIds(s)[0]).toBe('p2');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('may give both cards to the same player', () => {
    let s = h.choose(h.use(h.run(guoJia('alternate:guo-jia'), dmg(1))), 'p0');
    s = h.choose(h.choose(s, 'seat-c'), 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['p0', 'p1']);
  });

  it('asks again per point of damage, with fresh top cards', () => {
    let s = h.run(guoJia('alternate:guo-jia'), dmg(2));
    s = h.choose(h.choose(h.choose(h.use(s), 'p0'), 'seat-b'), 'seat-b');
    expect(askedAbout(s)).toBe(id);
    s = h.use(s);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['p2', 'p3']);
  });

  it('declining leaves the draw pile intact and nobody draws', () => {
    const s = h.decline(h.run(guoJia('alternate:guo-jia'), dmg(1)));
    expect(pileIds(s)).toEqual(top.map((c) => c.instanceId));
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('does not offer a dead recipient', () => {
    const dead = guoJia('alternate:guo-jia');
    const s0 = { ...dead, seats: dead.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    const s = h.choose(h.use(h.run(s0, dmg(1))), 'p0');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-d']);
  });

  it('with 1 card in the pile he gives that one; with none nothing happens', () => {
    let s = h.use(h.run(guoJia('alternate:guo-jia', [top[0]]), dmg(1)));
    expect(s.pendingChoice!.options.map((o) => o.id)).toContain('seat-b'); // straight to who gets it
    s = h.choose(s, 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['p0']);
    expect(s.pendingChoice).toBeUndefined();
    s = h.use(h.run(guoJia('alternate:guo-jia', []), dmg(1)));
    expect(s.pendingChoice).toBeUndefined();
  });

  it('the log says only that he used it', () => {
    const s = h.choose(h.choose(h.choose(h.use(h.run(guoJia('alternate:guo-jia'), dmg(1))), 'p0'), 'seat-b'), 'seat-c');
    expect(abilityLog(s)).toHaveLength(1);
    expect(s.log.filter((e) => e.kind === 'ChoiceMadeEvent' && e.reason.kind === 'ability' && e.reason.abilityId === id && e.shows.kind !== 'use').every((e) => e.kind === 'ChoiceMadeEvent' && e.secret)).toBe(true);
  });

  it('only he sees the cards: another seat\'s view shows no options and the pile stays masked', () => {
    const s = h.use(h.run(guoJia('alternate:guo-jia'), dmg(1)));
    const mine = redactStateForSeat(s, 'seat-a');
    expect(mine.pendingChoice!.options.map((o) => (o.shows.kind === 'card' ? o.shows.card.definitionId : null))).toEqual(['shan', 'shan']);
    const other = redactStateForSeat(s, 'seat-b');
    expect(other.pendingChoice!.options).toEqual([]);
    expect(JSON.stringify(other)).not.toContain('"definitionId":"shan"');
  });

  it('Default Guo Jia still draws 2 in the same scenario', () => {
    let s = h.use(h.run(guoJia('guo-jia'), dmg(1)));
    expect(handIds(s, 'seat-a')).toEqual(['p0', 'p1']);
    expect(askedAbout(s)).toBe('bestowed-rouse');
  });
});
