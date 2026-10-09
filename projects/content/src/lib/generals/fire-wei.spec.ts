import type { GameState } from 'engine';
import { abilityLog, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-xu-huang'): TableOptions['generals'] => ({ [seatId]: [main, deputy] });
const optionIds = (s: GameState) => s.pendingChoice?.options.map((o) => o.id);
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Dian Wei — Assault', () => {
  // 4 seats: seat-b and seat-d are 1 away from seat-a, seat-c 2 away.
  const pommel = card('w', 'black-pommel', 'spade', 6); // range 2

  it('offers discarding a Weapon only when he has one; Lose 1 HP always', () => {
    expect(optionIds(h.useSkill(table({}, { generals: at('seat-a', 'dian-wei') }), 'seat-a', 'assault'))).toEqual(['lose-hp']);
    expect(optionIds(h.useSkill(table({ 'seat-a:hand': [pommel] }, { generals: at('seat-a', 'dian-wei') }), 'seat-a', 'assault'))).toEqual(['discard-weapon', 'lose-hp']);
  });

  it('discards a worn Weapon, then deals 1 damage within the range left after it', () => {
    let s = h.useSkill(table({ 'seat-a:equip': [pommel] }, { generals: at('seat-a', 'dian-wei') }), 'seat-a', 'assault');
    s = h.select(h.choose(s, 'discard-weapon'), 'w');
    expect(ids(s, 'discardPile')).toContain('w');
    expect(optionIds(s)).toEqual(['seat-b', 'seat-d']); // seat-c was in range only with the sword
    s = h.choose(s, 'seat-b');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: { seatId: 'seat-a' }, cause: { skillId: 'assault' } } });
    expect(abilityLog(s).map((e) => e.kind === 'AbilityUsedEvent' && e.outcome)).toEqual(['used', 'paid-weapon', 'struck']); // 'used': the engine logs the active skill's use
  });

  it('or loses 1 HP; dying comes first, and a dead Dian Wei deals nothing', () => {
    const s = kw.choose(kw.useSkill(table({}, { generals: at('seat-a', 'dian-wei'), hp: { 'seat-a': 1 } }), 'seat-a', 'assault'), 'lose-hp');
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
    const gone = kw.pass(s);
    expect(gone.seats[0].eliminated).toBe(true);
    expect(gone.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });

  it('once per turn', () => {
    let s = h.choose(h.useSkill(table({}, { generals: at('seat-a', 'dian-wei') }), 'seat-a', 'assault'), 'lose-hp');
    s = h.choose(s, 'seat-b');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(offered(s, 'seat-a', 'assault')).toBe(false);
  });
});

describe('Xun Yu — Rouse the Tiger', () => {
  const rouse = (mine: number, theirs: number) =>
    table({ 'seat-a:hand': [card('k', 'sha', 'spade', mine)], 'seat-b:hand': [card('b', 'shan', 'heart', theirs)] }, { generals: at('seat-a', 'xun-yu'), hp: { 'seat-a': 3 } });

  it('only at a seat with more HP and a hand card', () => {
    expect(h.useSkill(rouse(13, 2), 'seat-a', 'rouse-the-tiger').pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b'] });
    expect(offered(table({ 'seat-a:hand': [card('k', 'sha')] }, { generals: at('seat-a', 'xun-yu') }), 'seat-a', 'rouse-the-tiger')).toBe(false);
  });

  it('a win: the target damages a seat in its range that Xun Yu picks, never itself', () => {
    let s = h.select(h.useSkill(rouse(13, 2), 'seat-a', 'rouse-the-tiger'), 'seat-b');
    s = h.select(s, 'k');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', eligibleIds: ['b'] });
    s = h.select(s, 'b');
    expect(ids(s, 'discardPile')).toEqual(['k', 'b']);
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'rouse-the-tiger', outcome: 'compete-won', targetSeatId: 'seat-b' }));
    expect(optionIds(s)).toEqual(['seat-c', 'seat-a']); // turn order from seat-b
    s = h.choose(s, 'seat-c');
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: { seatId: 'seat-b' } } });
  });

  it('a tie loses: the target damages Xun Yu', () => {
    const s = h.select(h.select(h.select(h.useSkill(rouse(7, 7), 'seat-a', 'rouse-the-tiger'), 'seat-b'), 'k'), 'b');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ outcome: 'compete-lost' }));
    expect(hp(s, 'seat-a')).toBe(2);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: { seatId: 'seat-b' } } });
  });
});

describe('Xun Yu — Eternal Loyalty', () => {
  it('per point of damage, a living seat (himself included) draws up to its max HP', () => {
    const pile = Array.from({ length: 12 }, (_, i) => card(`d${i}`, 'shan'));
    let s = h.run(table({ 'seat-a:hand': [card('x', 'shan')], drawPile: pile }, { generals: at('seat-a', 'xun-yu') }), [
      { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 2, nature: 'normal', cause: {} } },
    ]);
    s = h.use(s);
    expect(optionIds(s)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-a');
    expect(handIds(s, 'seat-a')).toHaveLength(4); // max HP 4
    s = h.use(s); // the second point
    s = h.choose(s, 'seat-c');
    expect(handIds(s, 'seat-c')).toHaveLength(4);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('Don’t: nothing is drawn', () => {
    const s = h.decline(h.run(table({}, { generals: at('seat-a', 'xun-yu') }), [
      { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1, nature: 'normal', cause: {} } },
    ]));
    expect(s.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
  });
});
