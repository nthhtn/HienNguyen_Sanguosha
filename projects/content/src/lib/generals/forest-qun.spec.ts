import type { GameState } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hit = (seatId: string, amount: number) => ({
  kind: 'DamageEffect' as const,
  damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
});
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Dong Zhuo — Wine', () => {
  it('a spade hand card can be used as Wine, a heart cannot', () => {
    let s = table({ 'seat-a:hand': [card('sp', 'shan', 'spade', 3), card('he', 'shan', 'heart', 3)] }, { generals: at('seat-a', 'dong-zhuo') });
    s = h.convert(s, 'seat-a', 'wine');
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['sp'] });
    s = h.select(s, 'sp');
    expect(s.turn.flags?.['wine']).toBe(true);
  });

  it('rescues himself while dying', () => {
    let s = kw.run(table({ 'seat-a:hand': [card('sp', 'shan', 'spade', 3)] }, { generals: at('seat-a', 'dong-zhuo'), hp: { 'seat-a': 1 } }), [hit('seat-a', 1)]);
    s = kw.convert(s, 'seat-a', 'wine');
    s = kw.select(s, 'sp');
    expect(hp(s, 'seat-a')).toBe(1);
  });
});

describe('Dong Zhuo — Garden of Lust', () => {
  const shaAt = (attacker: string, target: string, generals: TableOptions['generals'], targetCards: ReturnType<typeof card>[]) =>
    h.play(
      table({ [`${attacker}:hand`]: [card('s1', 'sha')], [`${target}:hand`]: targetCards }, { owner: attacker, generals }),
      's1',
      target
    );
  const shans = [card('d1', 'shan', 'heart', 2), card('d2', 'shan', 'heart', 3)];

  it('his Sha at a female needs two Shan', () => {
    let s = shaAt('seat-a', 'seat-b', { ...at('seat-a', 'dong-zhuo'), ...at('seat-b', 'diao-chan') }, shans);
    s = h.respond(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = h.respond(s, 'd2');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it("a female's Sha at him needs two too", () => {
    let s = shaAt('seat-b', 'seat-a', { ...at('seat-a', 'dong-zhuo'), ...at('seat-b', 'diao-chan') }, shans);
    s = h.respond(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
  });

  it('a male, or a hidden Dong Zhuo, needs one', () => {
    expect(shaAt('seat-a', 'seat-b', at('seat-a', 'dong-zhuo'), shans).pendingResponse).not.toBeNull();
    expect(h.respond(shaAt('seat-a', 'seat-b', at('seat-a', 'dong-zhuo'), shans), 'd1').pendingResponse).toBeNull();
    const hidden = h.respond(shaAt('seat-a', 'seat-b', { ...at('seat-a', 'dong-zhuo', 'filler-jiang-wei', false), ...at('seat-b', 'diao-chan') }, shans), 'd1');
    expect(hidden.pendingResponse).toBeNull();
  });
});

describe('Dong Zhuo — Collapse', () => {
  const big = (o: TableOptions = {}) => table({}, { generals: at('seat-a', 'dong-zhuo'), hp: { 'seat-a': 5 }, maxHp: { 'seat-a': 5 }, ...o });
  const ending = (s: GameState) => h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('at the end of his turn, with strictly the most HP, he loses 1 HP or reduces his max HP by 1', () => {
    let s = ending(big());
    expect(askedAbout(s)).toBe('collapse');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['lose-hp', 'reduce-max-hp']);
    expect(hp(h.choose(s, 'lose-hp'), 'seat-a')).toBe(4);
    s = h.choose(s, 'reduce-max-hp');
    expect(s.seats[0]).toMatchObject({ combinedHp: 4, maxCombinedHp: 4 });
  });

  it('a tie in HP, or a hidden Dong Zhuo, does nothing', () => {
    expect(askedAbout(ending(big({ hp: { 'seat-a': 5, 'seat-b': 5 } })))).toBeNull();
    expect(askedAbout(ending(big({ generals: at('seat-a', 'dong-zhuo', 'filler-jiang-wei', false) })))).toBeNull();
  });
});

describe('Jia Xu — Complete Kill', () => {
  const dyingB = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions = {}) =>
    kw.run(table(cards, { generals: at('seat-a', 'jia-xu'), hp: { 'seat-b': 1 }, ...o }), [hit('seat-b', 1)]);

  it("in his turn only he and the dying seat can use Peach", () => {
    let s = dyingB({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.seats[1].eliminated).toBe(true);
  });

  it('he may still use a Peach himself', () => {
    const s = dyingB({ 'seat-a:hand': [card('p', 'peach', 'heart', 4)] });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
  });

  it('a hidden Jia Xu leaves the dying round alone', () => {
    const s = kw.pass(dyingB({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] }, { generals: at('seat-a', 'jia-xu', 'filler-jiang-wei', false) }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });
});

describe('Jia Xu — Curtain', () => {
  it('black Tools are not offered at him; red ones are', () => {
    const s = table({ 'seat-b:hand': [card('bl', 'duel', 'spade', 5), card('rd', 'duel', 'heart', 5)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu') });
    const plays = h.legal(s, 'seat-b').filter((a) => a.kind === 'PlayCardAction' && a.targets[0]?.seatId === 'seat-a').map((a) => (a.kind === 'PlayCardAction' ? a.cardInstanceId : ''));
    expect(plays).toEqual(['rd']);
  });

  it('a black area Tool skips him', () => {
    let s = h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu') }), 'bb');
    const asked: string[] = [];
    while (s.pendingResponse) {
      asked.push(s.pendingResponse.respondingSeatId);
      s = h.pass(s);
    }
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('a hidden Jia Xu is hit', () => {
    let s = h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu', 'filler-jiang-wei', false) }), 'bb');
    const asked: string[] = [];
    while (s.pendingResponse) {
      asked.push(s.pendingResponse.respondingSeatId);
      s = h.pass(s);
    }
    expect(asked).toEqual(['seat-c', 'seat-d', 'seat-a']);
  });
});

describe('Jia Xu — Upheaval', () => {
  const upheaval = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) => h.useSkill(table(cards, { generals: at('seat-a', 'jia-xu'), ...o }), 'seat-a', 'upheaval');

  it('each other seat in turn picks a seat in its range, or passes', () => {
    const s = upheaval();
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-a', 'pass']); // turn order after seat-b
    expect(s.seats[0].marks).toEqual({ 'upheaval-used': 1 });
  });

  it('a seat that plays a Sha at the seat it picked: answered like any Sha, then the next seat is asked', () => {
    let s = upheaval({ 'seat-b:hand': [card('s1', 'sha')] });
    s = h.choose(s, 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'], reason: { kind: 'ability', abilityId: 'upheaval', targetSeatId: 'seat-c' } });
    s = h.respond(s, 's1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-c' });
  });

  it('passing, at the pick or at the Sha window, loses 1 HP and moves on', () => {
    const picked = h.choose(upheaval(), 'pass');
    expect(hp(picked, 'seat-b')).toBe(3);
    expect(picked.pendingChoice).toMatchObject({ seatId: 'seat-c' });
    const windowed = h.pass(h.choose(upheaval({ 'seat-b:hand': [card('s1', 'sha')] }), 'seat-c'));
    expect(hp(windowed, 'seat-b')).toBe(3);
    expect(windowed.pendingChoice).toMatchObject({ seatId: 'seat-c' });
  });

  it('a seat that died before its turn is skipped (Review Focus 5)', () => {
    const t = table({}, { generals: at('seat-a', 'jia-xu') });
    const s = h.run({ ...t, seats: t.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) }, [
      { kind: 'SkillStepEffect', owner: { kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'upheaval' }, step: 'next', data: { left: ['seat-c', 'seat-d'] } },
    ]);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-d' });
  });

  it('once per game', () => {
    const t = table({}, { generals: at('seat-a', 'jia-xu') });
    const used = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'upheaval-used': 1 } } : x)) };
    expect(offered(t, 'seat-a', 'upheaval')).toBe(true);
    expect(offered(used, 'seat-a', 'upheaval')).toBe(false);
  });
});
