import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
const hit = (seatId: string, amount: number) => ({
  kind: 'DamageEffect' as const,
  damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
});

describe('Pang Tong — Shackle', () => {
  const pile = [card('d1', 'shan', 'heart', 1), card('d2', 'shan', 'heart', 2)];

  it('discards a club hand card and draws 1, again and again', () => {
    let s = table({ 'seat-a:hand': [card('c1', 'duel', 'club', 3), card('c2', 'sha', 'club', 4), card('h', 'peach', 'heart')], drawPile: pile }, { generals: at('seat-a', 'pang-tong') });
    s = h.useSkill(s, 'seat-a', 'shackle');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['c1', 'c2'] });
    s = h.select(s, 'c1');
    expect(ids(s, 'discardPile')).toEqual(['c1']);
    expect(handIds(s, 'seat-a')).toEqual(['c2', 'h', 'd1']);
    s = h.select(h.useSkill(s, 'seat-a', 'shackle'), 'c2');
    expect(handIds(s, 'seat-a')).toEqual(['h', 'd1', 'd2']);
  });

  it('not offered without a club', () => {
    expect(offered(table({ 'seat-a:hand': [card('h', 'peach', 'heart')] }, { generals: at('seat-a', 'pang-tong') }), 'seat-a', 'shackle')).toBe(false);
  });
});

describe('Pang Tong — Nirvana', () => {
  const pile = Array.from({ length: 8 }, (_, i) => card(`d${i}`, 'shan', 'heart', i + 1));
  const pangTong = (o: TableOptions = {}) => {
    const t = table(
      { 'seat-a:hand': [card('x', 'sha')], 'seat-a:equip': [card('e', 'black-pommel', 'spade', 6)], 'seat-a:judgment': [card('j', 'capture', 'spade', 6)], drawPile: pile },
      { generals: at('seat-a', 'pang-tong'), hp: { 'seat-a': 1 }, ...o }
    );
    return { ...t, seats: t.seats.map((s) => (s.id === 'seat-a' ? { ...s, faceDown: true as const } : s)) };
  };

  it('on entering dying: discard every card, draw 3, recover to 3 HP, turn face up; no dying round', () => {
    let s = kw.run(pangTong(), [hit('seat-a', 2)]);
    expect(askedAbout(s)).toBe('nirvana');
    s = kw.use(s);
    expect(ids(s, 'discardPile').sort()).toEqual(['e', 'j', 'x']);
    expect(handIds(s, 'seat-a')).toEqual(['d0', 'd1', 'd2']);
    expect(hp(s, 'seat-a')).toBe(3);
    expect(s.seats[0].faceDown).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'nirvana', outcome: 'reborn' }));
  });

  it('recovers at most to his max HP', () => {
    expect(hp(kw.use(kw.run(pangTong({ maxHp: { 'seat-a': 2 } }), [hit('seat-a', 2)])), 'seat-a')).toBe(2);
  });

  it('once per game: the second time the dying round goes ahead (Review Focus 4)', () => {
    let s = kw.use(kw.run(pangTong(), [hit('seat-a', 2)]));
    s = kw.run(s, [hit('seat-a', 3)]);
    expect(askedAbout(s)).toBeNull();
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
  });

  it('Don’t: the dying round goes ahead', () => {
    const s = kw.decline(kw.run(pangTong(), [hit('seat-a', 2)]));
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
  });
});

describe('Fire Zhuge Liang — Eight Arrays', () => {
  // seat-b's Sha at Fire Zhuge Liang (seat-a), who holds no Shan.
  const shaAtHim = (cards: Record<string, ReturnType<typeof card>[]> = {}, revealed = true) =>
    h.play(
      table({ 'seat-b:hand': [card('s1', 'sha')], drawPile: [card('j', 'peach', 'heart', 3)], ...cards }, { owner: 'seat-b', generals: at('seat-a', 'fire-zhuge-liang', 'filler-jiang-wei', revealed) }),
      's1',
      'seat-a'
    );

  it('with no armour: asked; a red judgment counts as a Shan', () => {
    let s = shaAtHim();
    expect(askedAbout(s)).toBe('eight-arrays');
    s = h.use(s);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(ids(s, 'discardPile')).toContain('j');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'eight-arrays', outcome: 'counts-as-shan' }));
  });

  it('not asked while he wears armour (Review Focus 5)', () => {
    const s = shaAtHim({ 'seat-a:equip': [card('sl', 'silver-lion', 'club', 1)] });
    expect(askedAbout(s)).toBeNull();
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
  });

  it('not asked against a Black Pommel Sha (Review Focus 5)', () => {
    expect(askedAbout(shaAtHim({ 'seat-b:equip': [card('bp', 'black-pommel', 'spade', 6)] }))).toBeNull();
  });

  it('not asked while his General is hidden (a compulsory skill)', () => {
    expect(askedAbout(shaAtHim({}, false))).toBeNull();
  });
});

describe('Fire Zhuge Liang — Fire Strategy', () => {
  const blazes = (s: GameState) => h.legal(s, 'seat-a').filter((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'fire-strategy');

  it('a red hand card as Blaze, at any living seat with a hand card, himself included', () => {
    const s = table({ 'seat-a:hand': [card('r', 'shan', 'heart', 5), card('k', 'shan', 'spade', 6)], 'seat-c:hand': [card('c', 'sha')] }, { generals: at('seat-a', 'fire-zhuge-liang') });
    expect(blazes(s).map((a) => a.kind === 'UseConversionAction' && a.targets[0].seatId)).toEqual(['seat-a', 'seat-c']);
    const selecting = h.act(s, blazes(s)[1]);
    expect(selecting.pendingSelection?.eligibleIds).toEqual(['r']);
  });

  it('not offered with only black cards', () => {
    expect(blazes(table({ 'seat-a:hand': [card('k', 'shan', 'spade')], 'seat-c:hand': [card('c', 'sha')] }, { generals: at('seat-a', 'fire-zhuge-liang') }))).toEqual([]);
  });

  it('played: the target shows a card, a matching discard deals 1 damage', () => {
    // All red: a black card would offer See Through against his own Blaze.
    let s = table({ 'seat-a:hand': [card('r', 'shan', 'heart', 5), card('m', 'shan', 'diamond', 2)], 'seat-b:hand': [card('t', 'sha', 'diamond', 9)] }, { generals: at('seat-a', 'fire-zhuge-liang') });
    s = h.select(h.convert(s, 'seat-a', 'fire-strategy', 'seat-b'), 'r');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'blaze', physical: [{ instanceId: 'r' }] } });
    s = h.select(s, 't');
    s = h.select(s, 'm');
    expect(hp(s, 'seat-b')).toBe(3);
  });
});

describe('Fire Zhuge Liang — See Through', () => {
  // seat-b Steals from Fire Zhuge Liang (seat-a, its neighbour).
  const stolenFrom = (hand: ReturnType<typeof card>[]) =>
    h.play(table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': hand }, { owner: 'seat-b', generals: at('seat-a', 'fire-zhuge-liang') }), 'st', 'seat-a');

  it('a black hand card answers the Wuxie check as Wuxie and cancels the Tool', () => {
    let s = stolenFrom([card('k', 'shan', 'club', 4), card('r', 'peach', 'heart', 3)]);
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    s = h.select(h.convert(s, 'seat-a', 'see-through'), 'k');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent' && e.card.as === 'wuxie')).toMatchObject({ seatId: 'seat-a', card: { physical: [{ instanceId: 'k' }] } });
    expect(handIds(s, 'seat-a')).toEqual(['r']);
    expect(handIds(s, 'seat-b')).toEqual([]);
  });

  it('with only red cards he isn’t asked', () => {
    expect(stolenFrom([card('r', 'peach', 'heart', 3)]).pendingResponse).toBeNull();
  });
});
