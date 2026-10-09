import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', revealed] });
const pile = (n: number, suit: 'heart' | 'spade' = 'heart') => Array.from({ length: n }, (_, i) => card(`c${i + 1}`, 'shan', suit, i + 1));
const drawn = (s: GameState) => s.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));

describe('Huang Yueying — Gathering Wisdom', () => {
  it('may draw 1 when she plays a non-delayed Tool, before it takes effect', () => {
    const s = h.play(table({ 'seat-a:hand': [card('dt', 'draw-two', 'heart', 7)], drawPile: pile(3) }, { generals: at('seat-a', 'huang-yueying') }), 'dt');
    expect(askedAbout(s)).toBe('gathering-wisdom');
    expect(drawn(h.use(s))).toEqual([1, 2]);
    expect(drawn(h.decline(s))).toEqual([2]);
  });

  it('counts a Wuxie she plays as an answer, and not a delayed Tool or a Basic card', () => {
    let s = h.play(table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('wx', 'wuxie', 'spade', 11)], drawPile: pile(2) }, { owner: 'seat-b', generals: at('seat-a', 'huang-yueying') }), 'st', 'seat-a');
    s = h.respond(s, 'wx');
    expect(askedAbout(s)).toBe('gathering-wisdom');
    const capture = h.play(table({ 'seat-a:hand': [card('cp', 'capture', 'spade', 6)] }, { generals: at('seat-a', 'huang-yueying') }), 'cp', 'seat-b');
    expect(capture.pendingChoice).toBeUndefined();
    const sha = h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: at('seat-a', 'huang-yueying') }), 's1', 'seat-b');
    expect(sha.pendingChoice).toBeUndefined();
  });
});

describe('Ma Chao — Iron Cavalry', () => {
  const attack = (judged: 'heart' | 'spade', more: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')], drawPile: [card('j', 'peach', judged, 2)], ...more }, { generals: at('seat-a', 'ma-chao') }), 's1', 'seat-b');

  it('after targeting a seat with a Sha, may judge: on red that seat can’t play a Shan against it', () => {
    let s = attack('heart');
    expect(askedAbout(s)).toBe('iron-cavalry');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-b' });
    s = h.use(s);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'iron-cavalry', outcome: 'unblockable', targetSeatId: 'seat-b' })]);
    expect(ids(s, 'discardPile')).toContain('j');
  });

  it('on black the Shan is asked for as normal', () => {
    expect(h.use(attack('spade')).pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('a red judgment also keeps Eight Trigrams out', () => {
    const s = h.use(attack('heart', { 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)] }));
    expect(s.pendingChoice).toBeUndefined();
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('armour still applies: Black Shield stops a black Sha', () => {
    const s = h.use(attack('heart', { 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] }));
    expect(hp(s, 'seat-b')).toBe(4);
  });
});

describe('Zhuge Liang — Astrology', () => {
  // seat-d's turn ends; seat-a's Start Phase begins.
  const start = (seats: number, cards = pile(6)) =>
    h.settle(table({ drawPile: cards }, { seats, generals: at('seat-a', 'zhuge-liang'), owner: seats === 6 ? 'seat-f' : 'seat-d', phase: 'End' }));

  it('looks at the top X cards (X = living seats) and puts each on top or at the bottom, in any order', () => {
    let s = start(4);
    expect(askedAbout(s)).toBe('astrology');
    s = h.use(s);
    expect(s.pendingArrangement?.cardInstanceIds).toEqual(['c1', 'c2', 'c3', 'c4']);
    s = h.arrange(s, ['c3', 'c1'], ['c2', 'c4']);
    expect(ids(s, 'drawPile')).toEqual(['c3', 'c1', 'c5', 'c6', 'c2', 'c4']);
  });

  it('looks at no more than 5', () => {
    expect(h.use(start(6, pile(7))).pendingArrangement?.cardInstanceIds).toHaveLength(5);
  });
});

describe('Liu Bei — Kindness', () => {
  const hand = ['k1', 'k2', 'k3', 'k4'].map((id) => card(id, 'shan', 'spade'));
  const liuBei = (combinedHp: number) => table({ 'seat-a:hand': hand }, { generals: at('seat-a', 'liu-bei'), hp: { 'seat-a': combinedHp } });
  const give = (s: GameState, to: string, ...cards: string[]) => h.choose(h.select(h.useSkill(s, 'seat-a', 'kindness'), ...cards), to);

  it('gives any hand cards to another seat, any number of times; he recovers 1 HP once, when 2 have been given', () => {
    let s = give(liuBei(2), 'seat-b', 'k1');
    expect(handIds(s, 'seat-b')).toEqual(['k1']);
    expect(hp(s, 'seat-a')).toBe(2);
    s = give(s, 'seat-c', 'k2');
    expect(hp(s, 'seat-a')).toBe(3);
    s = give(s, 'seat-b', 'k3', 'k4');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(handIds(s, 'seat-b')).toEqual(['k1', 'k3', 'k4']);
  });

  it('Cancel undoes the use: nothing is counted and it is offered again', () => {
    const s = h.cancel(h.useSkill(liuBei(3), 'seat-a', 'kindness'));
    expect(s.turn.abilityUses).toBeUndefined();
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });

  it('is not offered with an empty hand', () => {
    expect(h.legal(table({}, { generals: at('seat-a', 'liu-bei') }), 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(false);
  });
});
