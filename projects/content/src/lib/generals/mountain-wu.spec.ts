import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, ids, registry, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);
const draws = Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));

describe('Sun Ce — Passion', () => {
  const sha = (suit: 'heart' | 'spade', o: TableOptions = {}) =>
    table({ 'seat-a:hand': [card('s1', 'sha', suit)], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), ...o });

  it('being targeted by a red Sha draws 1 card', () => {
    const s = h.play(sha('heart'), 's1', 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it('a black Sha draws nothing', () => {
    expect(handIds(h.play(sha('spade'), 's1', 'seat-b'), 'seat-b')).toEqual([]);
  });

  it('using a red Sha draws 1 card for Sun Ce, once per target', () => {
    const s = h.play(table({ 'seat-b:hand': [card('s1', 'sha', 'heart')], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), owner: 'seat-b' }), 's1', 'seat-c');
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it('a Duel used on him, or by him, draws 1 card', () => {
    const on = h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade')], drawPile: draws }, { generals: at('seat-b', 'sun-ce') }), 'du', 'seat-b');
    expect(handIds(on, 'seat-b')).toEqual(['d1']); // drawn once, not twice
    const by = h.play(table({ 'seat-b:hand': [card('du', 'duel', 'spade')], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), owner: 'seat-b' }), 'du', 'seat-a');
    expect(handIds(by, 'seat-b')).toEqual(['d1']);
  });

  it('is off while he is hidden', () => {
    expect(handIds(h.play(sha('heart', { generals: at('seat-b', 'sun-ce', 'filler-xu-huang', false) }), 's1', 'seat-b'), 'seat-b')).toEqual([]);
  });
});

describe('Sun Ce — Soul Position', () => {
  const start = (hp: number) => h.settle(table({}, { generals: at('seat-a', 'sun-ce'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': hp } }));

  it('at the start of his turn with exactly 1 HP: max HP −1, Brave Gesture and Brave Spirit gained', () => {
    const s = start(1);
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 1 });
    expect(inPlay(s, 'seat-a')).toEqual(expect.arrayContaining(['brave-gesture', 'brave-spirit']));
    expect(s.seats[0].marks?.['awakened:soul-position']).toBe(1);
  });

  it('not at 2 HP', () => {
    const s = start(2);
    expect(s.seats[0].maxCombinedHp).toBe(4);
    expect(inPlay(s, 'seat-a')).not.toContain('brave-gesture');
  });

  it('the gained Brave Gesture is offered at his next Draw Phase', () => {
    const s = h.run(start(1), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    expect(askedAbout(s)).toBe('brave-gesture');
  });
});

describe('Sun Ce — Takeover', () => {
  it('is a Lord skill, so it is never in play', () => {
    expect(inPlay(table({}, { generals: at('seat-a', 'sun-ce') }), 'seat-a')).not.toContain('takeover');
  });
});

describe('Zhang Zhao and Zhang Hong — Direct Instruction', () => {
  const play = (cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('cb', 'crossbow', 'club'), card('x1', 'shan', 'heart', 2)], drawPile: draws, ...cards }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong') });

  it('places an equipment card from hand in another seat’s empty slot and draws 1', () => {
    let s = h.useSkill(play(), 'seat-a', 'direct-instruction');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['cb'], min: 1, max: 1 });
    s = h.select(s, 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(ids(s, 'seat-c:equip')).toEqual(['cb']);
    expect(handIds(s, 'seat-a')).toEqual(['x1', 'd1']);
  });

  it('a seat with that slot filled is not offered, and with none free the skill is not offered', () => {
    const s = h.select(h.useSkill(play({ 'seat-b:equip': [card('wb', 'crossbow', 'spade')] }), 'seat-a', 'direct-instruction'), 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
    const blocked = play({ 'seat-b:equip': [card('w1', 'crossbow')], 'seat-c:equip': [card('w2', 'crossbow')], 'seat-d:equip': [card('w3', 'crossbow')] });
    expect(h.legal(blocked, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(false);
  });

  it('may be used any number of times in a turn', () => {
    let s = h.choose(h.select(h.useSkill(play({ 'seat-a:hand': [card('cb', 'crossbow', 'club'), card('wc', 'black-pommel', 'spade')] }), 'seat-a', 'direct-instruction'), 'cb'), 'seat-b');
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });

  it('cancelling the card pick does not count as a use', () => {
    const s = h.cancel(h.useSkill(play(), 'seat-a', 'direct-instruction'));
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });
});

describe('Zhang Zhao and Zhang Hong — Stubborn', () => {
  // seat-b's Discard Phase: it holds 6 cards at 4 HP and discards 2.
  const discarding = (extra: Record<string, ReturnType<typeof card>[]> = {}) => {
    const six = Array.from({ length: 6 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    return h.act(table({ 'seat-b:hand': six, ...extra }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
  };
  const discard = (s: ReturnType<typeof table>, ...cardIds: string[]) => cardIds.reduce((acc, id) => h.act(acc, { kind: 'DiscardCardAction', seatId: 'seat-b', cardInstanceId: id }), s);

  it('at the end of another seat’s Discard Phase with 2 or more discarded, he may give one back and take the rest', () => {
    let s = discard(discarding(), 'k1', 'k2');
    expect(askedAbout(s)).toBe('stubborn');
    s = h.use(s);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['k1', 'k2']);
    s = h.choose(s, 'k1');
    expect(handIds(s, 'seat-b')).toContain('k1');
    expect(handIds(s, 'seat-a')).toEqual(['k2']);
  });

  it('with 3 discarded he takes the other two', () => {
    const six = Array.from({ length: 7 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    let s = h.act(table({ 'seat-b:hand': six }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    s = h.choose(h.use(discard(s, 'k1', 'k2', 'k3')), 'k2');
    expect(handIds(s, 'seat-a')).toEqual(['k1', 'k3']);
  });

  it('not asked with 1 card discarded, or in his own Discard Phase', () => {
    const five = Array.from({ length: 5 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    const one = h.act(table({ 'seat-b:hand': five }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    expect(askedAbout(discard(one, 'k1'))).toBeNull();
  });

  it('Don’t leaves the cards in the discard pile', () => {
    const s = h.decline(discard(discarding(), 'k1', 'k2'));
    expect(ids(s, 'discardPile')).toEqual(['k1', 'k2']);
  });
});
