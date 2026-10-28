import { abilityLog, askedAbout, card, handIds, harness, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hit = (seatId: string, amount: number) => ({
  kind: 'DamageEffect' as const,
  damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
});

describe('Xu Huang — Blockade', () => {
  const hand = { 'seat-a:hand': [card('c1', 'sha', 'club', 4), card('e1', 'crossbow', 'club', 1), card('r1', 'shan', 'heart', 3), card('t1', 'duel', 'spade', 2)] };

  it('any black Basic or Equipment hand card can be used as Starvation, at distance 2', () => {
    let s = table(hand, { generals: at('seat-a', 'xu-huang') });
    s = h.convert(s, 'seat-a', 'blockade', 'seat-c');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['c1', 'e1'] }); // not the red Dodge, not the black Tool
    s = h.select(s, 'c1');
    expect(ids(s, 'seat-c:judgment')).toEqual(['c1']);
  });

  it('without Blockade the same card is not offered as Starvation', () => {
    const s = table(hand, { generals: at('seat-a', 'filler-xu-huang') });
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseConversionAction')).toBe(false);
  });

  it('a hidden Xu Huang is offered it too, and the reach is the normal 1 until he is revealed', () => {
    const s = table(hand, { generals: at('seat-a', 'xu-huang', 'filler-jiang-wei', false) });
    const targets = h.legal(s, 'seat-a').filter((a) => a.kind === 'UseConversionAction').map((a) => (a.kind === 'UseConversionAction' ? a.targets[0].seatId : ''));
    expect(targets).toEqual(['seat-b', 'seat-d']);
  });
});

describe('Cao Pi — Unnatural Death', () => {
  const victim = (o: TableOptions = {}) =>
    table(
      { 'seat-b:hand': [card('x', 'sha')], 'seat-b:equip': [card('e', 'black-pommel', 'spade', 6)], 'seat-b:judgment': [card('j', 'capture', 'spade', 6)] },
      { generals: at('seat-a', 'cao-pi'), hp: { 'seat-b': 1 }, ...o }
    );
  // seat-b is hit to 0, nobody can save it: it is eliminated.
  const dies = (s: ReturnType<typeof victim>) => kw.pass(kw.run(s, [hit('seat-b', 1)]));

  it('when another seat dies, Cao Pi may take all its hand, equipment and Judgment cards', () => {
    let s = dies(victim());
    expect(askedAbout(s)).toBe('unnatural-death');
    s = kw.use(s);
    expect(handIds(s, 'seat-a').sort()).toEqual(['e', 'j', 'x']);
    expect(ids(s, 'discardPile')).toEqual([]);
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'unnatural-death', outcome: 'took-cards', targetSeatId: 'seat-b' }));
  });

  it("Don't: everything is discarded as usual, and he is asked once (Review Focus 1)", () => {
    const s = kw.decline(dies(victim()));
    expect(s.pendingChoice).toBeUndefined();
    expect(ids(s, 'discardPile').sort()).toEqual(['e', 'j', 'x']);
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('a seat with no cards is not asked about', () => {
    const s = dies(table({}, { generals: at('seat-a', 'cao-pi'), hp: { 'seat-b': 1 } }));
    expect(askedAbout(s)).toBeNull();
  });

  it('does not apply to his own death, and a hidden Cao Pi is offered it as a reveal', () => {
    const own = kw.pass(kw.run(table({ 'seat-a:hand': [card('x', 'sha')] }, { generals: at('seat-a', 'cao-pi'), hp: { 'seat-a': 1 } }), [hit('seat-a', 1)]));
    expect(askedAbout(own)).toBeNull();
    const hidden = dies(victim({ generals: at('seat-a', 'cao-pi', 'filler-jiang-wei', false) }));
    expect(askedAbout(hidden)).toBe('unnatural-death');
    expect(hidden.pendingChoice!.options.find((o) => o.id === 'use')!.shows).toMatchObject({ kind: 'use', reveals: 'main' });
  });
});

describe('Cao Pi — Exile', () => {
  const hurt = (o: TableOptions = {}) => table({ drawPile: [1, 2, 3, 4].map((n) => card(`d${n}`, 'shan', 'heart', n)) }, { generals: at('seat-a', 'cao-pi'), maxHp: { 'seat-a': 3 }, hp: { 'seat-a': 3 }, ...o });

  it('after damage, turns another seat face down and it draws his missing HP', () => {
    let s = h.run(hurt(), [hit('seat-a', 2)]);
    expect(askedAbout(s)).toBe('exile');
    s = h.choose(h.use(s), 'seat-b');
    expect(s.seats[1].faceDown).toBe(true);
    expect(handIds(s, 'seat-b')).toEqual(['d1', 'd2']); // 3 max HP - 1 HP
  });

  it('a face-down seat turns face up, and still draws', () => {
    const t = hurt();
    const s0 = { ...t, seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, faceDown: true as const } : x)) };
    const s = h.choose(h.use(h.run(s0, [hit('seat-a', 1)])), 'seat-b');
    expect(s.seats[1].faceDown).toBeUndefined();
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it("Don't does nothing, and zero damage never asks", () => {
    expect(h.decline(h.run(hurt(), [hit('seat-a', 1)])).seats[1].faceDown).toBeUndefined();
    expect(askedAbout(h.run(hurt(), [hit('seat-a', 0)]))).toBeNull();
  });

  it('never offers himself', () => {
    const s = h.use(h.run(hurt(), [hit('seat-a', 1)]));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });
});
