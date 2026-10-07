import { abilityLog, askedAbout, card, handIds, harness, hp, kwMode, table, TableOptions } from './skills.testing';

const kw = harness(kwMode);
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'diamond', i + 1));
// seat-a's Judgment Phase ends; its Draw Phase draw comes next.
const drawPhase = (generals: [string, string], cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
  kw.settle(table({ drawPile: pile, ...cards }, { phase: 'Judgment', generals: { 'seat-a': generals }, ...o }));

describe('Xu Chu — Bare the Chest', () => {
  it('draws 1 fewer; his Sha and Duel then deal 1 more damage this turn', () => {
    let s = drawPhase(['xu-chu', 'zhang-he'], { 'seat-a:hand': [card('s1', 'sha'), card('du', 'duel', 'spade', 1)] });
    expect(askedAbout(s)).toBe('bare-the-chest');
    s = kw.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['s1', 'du', 'd1']);
    expect(s.turn.flags).toEqual({ 'bare-the-chest': true });
    const hit = kw.pass(kw.play(s, 's1', 'seat-b'));
    expect(hp(hit, 'seat-b')).toBe(2);
    expect(abilityLog(hit).at(-1)).toMatchObject({ abilityId: 'bare-the-chest', outcome: 'more-damage', targetSeatId: 'seat-b' });
    expect(hp(kw.pass(kw.play(s, 'du', 'seat-c')), 'seat-c')).toBe(2);
  });

  it("Don't draws the usual 2, and nothing is boosted", () => {
    const s = kw.decline(drawPhase(['xu-chu', 'zhang-he'], { 'seat-a:hand': [card('s1', 'sha')] }));
    expect(handIds(s, 'seat-a')).toEqual(['s1', 'd1', 'd2']);
    expect(hp(kw.pass(kw.play(s, 's1', 'seat-b')), 'seat-b')).toBe(3);
  });

  it('boosts only his own damage', () => {
    let s = kw.use(drawPhase(['xu-chu', 'zhang-he']));
    s = kw.run(s, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', cause: { card: { as: 'sha', colour: 'black', physical: [] } } } }]);
    expect(hp(s, 'seat-c')).toBe(3);
  });
});

describe('Zhang Liao — Raid', () => {
  const hands = { 'seat-b:hand': [card('b1', 'sha')], 'seat-d:hand': [card('x1', 'peach', 'heart'), card('x2', 'shan')] };

  it('instead of drawing, takes a random hand card from each of 1 or 2 other seats, in seat order', () => {
    let s = kw.use(drawPhase(['zhang-liao', 'zhang-he'], hands));
    expect(s.pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-d'], min: 1, max: 2 });
    s = kw.select(s, 'seat-d', 'seat-b');
    expect(handIds(s, 'seat-a')).toHaveLength(2);
    expect(handIds(s, 'seat-a')[0]).toBe('b1');
    expect(handIds(s, 'seat-b')).toEqual([]);
    expect(handIds(s, 'seat-d')).toHaveLength(1);
    expect(abilityLog(s).map((e) => e.targetSeatId)).toEqual(['seat-b', 'seat-d']);
  });

  it('Cancel at the pick goes back to the draw', () => {
    const s = kw.cancel(kw.use(drawPhase(['zhang-liao', 'zhang-he'], hands)));
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('is not asked when no other seat holds a hand card', () => {
    expect(drawPhase(['zhang-liao', 'zhang-he']).pendingChoice).toBeUndefined();
  });

  it('with Bare the Chest on the Deputy: Raid is asked first, then Bare the Chest', () => {
    let s = drawPhase(['zhang-liao', 'xu-chu'], hands);
    expect(askedAbout(s)).toBe('raid');
    s = kw.decline(s);
    expect(askedAbout(s)).toBe('bare-the-chest');
    expect(handIds(kw.use(s), 'seat-a')).toEqual(['d1']);
  });
});

describe('Zhou Yu — Brave Gesture', () => {
  it('draws 1 extra card', () => {
    const s = drawPhase(['zhou-yu', 'sun-jian']);
    expect(askedAbout(s)).toBe('brave-gesture');
    expect(handIds(kw.use(s), 'seat-a')).toEqual(['d1', 'd2', 'd3']);
    expect(handIds(kw.decline(s), 'seat-a')).toEqual(['d1', 'd2']);
  });
});

describe('Bare the Chest, then Raid (final review #4)', () => {
  it('once Bare the Chest is used, Raid is not asked: the 1 fewer card must be drawn', () => {
    let s = drawPhase(['xu-chu', 'zhang-liao'], { 'seat-b:hand': [card('b1', 'sha')], 'seat-d:hand': [card('x1', 'shan')] });
    expect(askedAbout(s)).toBe('bare-the-chest');
    s = kw.use(s);
    expect(s.pendingChoice).toBeUndefined();
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
  });
});
