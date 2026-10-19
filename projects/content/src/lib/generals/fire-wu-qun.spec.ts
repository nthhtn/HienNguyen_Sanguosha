import type { Action, GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy: string): TableOptions['generals'] => ({ [seatId]: [main, deputy] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
const shaPlays = (s: GameState, cardId: string) => h.legal(s, 'seat-a').filter((a): a is Extract<Action, { kind: 'PlayCardAction' }> => a.kind === 'PlayCardAction' && a.cardInstanceId === cardId);

describe('Taishi Ci — Heaven’s Justice', () => {
  const taishiCi = at('seat-a', 'taishi-ci', 'filler-sun-jian');
  // Taishi Ci competes with seat-c (2 away) holding `theirs`.
  const compete = (s: GameState, mine: string) => h.select(h.select(h.select(h.useSkill(s, 'seat-a', 'heavens-justice'), 'seat-c'), mine), 'c');

  it('competes with any seat holding a hand card, distance aside', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 13)], 'seat-c:hand': [card('c', 'shan', 'heart', 2)] }, { generals: taishiCi });
    expect(h.useSkill(s, 'seat-a', 'heavens-justice').pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-c'] });
  });

  it('a win: one more Slash this turn, at any distance, with one more target', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 13), card('s1', 'sha'), card('s2', 'sha')], 'seat-c:hand': [card('c', 'shan', 'heart', 2)] }, { generals: taishiCi });
    s = compete(s, 'k');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'heavens-justice', outcome: 'compete-won', targetSeatId: 'seat-c' }));
    expect(shaPlays(s, 's1')).toEqual([expect.objectContaining({ targets: [], pickTargets: { eligibleIds: ['seat-b', 'seat-c', 'seat-d'], min: 1, max: 2 } })]);
    s = h.play(s, 's1', 'seat-c');
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(shaPlays(s, 's2')).toHaveLength(1); // the second Slash is still playable
  });

  it('a tie loses: no Slash this turn (Review Focus 3)', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 7), card('s1', 'sha')], 'seat-c:hand': [card('c', 'shan', 'heart', 7)] }, { generals: taishiCi });
    s = compete(s, 'k');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ outcome: 'compete-lost' }));
    expect(shaPlays(s, 's1')).toEqual([]);
  });

  it('once per turn', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 7), card('x', 'shan')], 'seat-c:hand': [card('c', 'shan', 'heart', 2), card('y', 'shan')] }, { generals: taishiCi });
    s = compete(s, 'k');
    expect(offered(s, 'seat-a', 'heavens-justice')).toBe(false);
  });

  it('with Sky Scorcher and his last hand card a Slash: 4 targets, one Slash counted, each answers on its own (Review Focus 1)', () => {
    let s = table(
      { 'seat-a:hand': [card('k', 'shan', 'spade', 13), card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)], 'seat-c:hand': [card('c', 'shan', 'heart', 2)], 'seat-e:hand': [card('n', 'shan')] },
      { generals: taishiCi, seats: 6 }
    );
    s = compete(s, 'k');
    expect(shaPlays(s, 's1')).toEqual([expect.objectContaining({ pickTargets: { eligibleIds: ['seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'], min: 1, max: 4 } })]);
    expect(() => h.play(s, 's1', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f')).toThrow();
    s = h.play(s, 's1', 'seat-f', 'seat-c', 'seat-e', 'seat-d');
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    const order: string[] = [];
    while (s.pendingResponse) {
      order.push(s.pendingResponse.respondingSeatId);
      s = s.pendingResponse.respondingSeatId === 'seat-e' ? h.respond(s, 'n') : h.pass(s);
    }
    expect(order).toEqual(['seat-c', 'seat-d', 'seat-e', 'seat-f']);
    expect(['seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'].map((id) => hp(s, id))).toEqual([4, 3, 3, 4, 3]);
  });
});

describe('Pang De', () => {
  const pangDe = at('seat-a', 'pang-de', 'filler-dong-zhuo');

  it('Horsemanship: 1 nearer to everyone (a Slash reaches seat-c)', () => {
    const plays = shaPlays(table({ 'seat-a:hand': [card('s1', 'sha'), card('x', 'shan')] }, { generals: pangDe }), 's1');
    expect(plays.map((a) => a.targets[0].seatId)).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });

  it('Sudden Attack: after a seat dodges his Slash, he may discard one of its cards (its hand face down, or worn)', () => {
    let s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n', 'shan'), card('h', 'peach', 'heart')], 'seat-b:equip': [card('dh', 'di-lu', 'club', 5)] }, { generals: pangDe });
    s = h.respond(h.play(s, 's1', 'seat-b'), 'n');
    expect(askedAbout(s)).toBe('sudden-attack');
    s = h.use(s);
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['hand', 'dh']);
    s = h.choose(s, 'dh');
    expect(ids(s, 'discardPile')).toContain('dh');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'sudden-attack', outcome: 'discarded', targetSeatId: 'seat-b' }));
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('also after an Eight Trigrams dodge', () => {
    let s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('h', 'peach', 'heart')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart', 3)] }, { generals: pangDe });
    s = h.use(h.play(s, 's1', 'seat-b'));
    expect(askedAbout(s)).toBe('sudden-attack');
  });

  it('not asked when the dodger has nothing left', () => {
    const s = h.respond(h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n', 'shan')] }, { generals: pangDe }), 's1', 'seat-b'), 'n');
    expect(askedAbout(s)).toBeNull();
  });
});

describe('Yan Liang and Wen Chou — Dueling Heroes', () => {
  const heroes = at('seat-a', 'yan-liang-and-wen-chou', 'filler-dong-zhuo');
  const drawPhase = (top: ReturnType<typeof card>, hand: ReturnType<typeof card>[] = []) =>
    h.run(table({ drawPile: [top, card('d1', 'shan'), card('d2', 'shan')], 'seat-a:hand': hand }, { generals: heroes, phase: 'Draw' }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
  const duels = (s: GameState) => h.legal({ ...s, phase: 'Play' }, 'seat-a').filter((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'dueling-heroes');

  it('instead of drawing: judge and take the card', () => {
    let s = drawPhase(card('j', 'peach', 'heart', 3));
    expect(askedAbout(s)).toBe('dueling-heroes');
    s = h.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['j']);
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'dueling-heroes', outcome: 'judged-red' }));
  });

  it('after a red judgment, only black hand cards are Duels this turn; after black, only red', () => {
    const red = h.use(drawPhase(card('j', 'peach', 'heart', 3), [card('b', 'shan', 'club', 4)]));
    expect(duels(red).length).toBeGreaterThan(0);
    const picks = h.act({ ...red, phase: 'Play' }, duels(red)[0]).pendingSelection!.eligibleIds;
    expect(picks).toEqual(['b']);
    const black = h.use(drawPhase(card('j', 'sha', 'spade', 3), [card('b', 'shan', 'club', 4)]));
    expect(duels(black)).toEqual([]); // the only other card is the black judgment itself
    expect(h.act({ ...black, phase: 'Play', zones: black.zones.map((z) => (z.id === 'seat-a:hand' ? { ...z, cards: [...z.cards, card('r', 'shan', 'diamond', 2)] } : z)) }, duels({ ...black, zones: black.zones.map((z) => (z.id === 'seat-a:hand' ? { ...z, cards: [...z.cards, card('r', 'shan', 'diamond', 2)] } : z)) })[0]).pendingSelection!.eligibleIds).toEqual(['r']);
  });

  it('not on another seat’s turn', () => {
    const s = h.use(drawPhase(card('j', 'peach', 'heart', 3), [card('b', 'shan', 'club', 4)]));
    expect(h.legal({ ...s, phase: 'Play', turn: { ...s.turn, ownerSeatId: 'seat-b' } }, 'seat-a').some((a) => a.kind === 'UseConversionAction')).toBe(false);
  });

  it('Don’t: the draw goes ahead', () => {
    expect(handIds(h.decline(drawPhase(card('j', 'peach', 'heart', 3))), 'seat-a')).toEqual(['j', 'd1']);
  });
});

describe('Yuan Shao — Random Strike', () => {
  const yuanShao = at('seat-a', 'yuan-shao', 'filler-dong-zhuo');
  const strikes = (s: GameState) => h.legal(s, 'seat-a').filter((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'random-strike');

  it('2 hand cards of one suit as Hail of Arrows', () => {
    let s = table({ 'seat-a:hand': [card('h1', 'shan', 'heart', 2), card('h2', 'peach', 'heart', 3), card('s1', 'shan', 'spade', 4)] }, { generals: yuanShao });
    expect(strikes(s)).toHaveLength(1);
    s = h.act(s, strikes(s)[0]);
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['h1', 'h2'], sameSuit: true });
    s = h.select(s, 'h1', 'h2');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'hail-of-arrows' } });
  });

  it('not with 2 cards of different suits', () => {
    expect(strikes(table({ 'seat-a:hand': [card('h1', 'shan', 'heart'), card('s1', 'shan', 'spade')] }, { generals: yuanShao }))).toEqual([]);
  });
});
