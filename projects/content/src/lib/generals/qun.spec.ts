import type { Effect, GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, kwMode, seat, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [main, 'filler-jia-xu', revealed] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Lu Bu — Matchless', () => {
  it('his Sha needs two Shan; an Eight Trigrams red judgment counts as one', () => {
    let s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart')] }, { generals: at('seat-a', 'lu-bu') }), 's1', 'seat-b');
    s = h.use(s); // Eight Trigrams: red
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
    expect(hp(h.respond(s, 'n1'), 'seat-b')).toBe(4);
  });

  it('in a Duel with him, the other seat plays two Sha each time', () => {
    let s = h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)], 'seat-b:hand': [card('b1', 'sha')] }, { generals: at('seat-a', 'lu-bu') }), 'du', 'seat-b');
    s = h.respond(s, 'b1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
  });

  it('is off while Lu Bu is hidden: one Shan is enough', () => {
    const s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')] }, { generals: at('seat-a', 'lu-bu', false) }), 's1', 'seat-b');
    expect(h.respond(s, 'n1').pendingResponse).toBeNull();
  });
});

describe('Hua Tuo — First Aid', () => {
  // seat-c drops to 0 HP in `owner`'s turn; Hua Tuo (seat-a) holds a red card and no Peach.
  const dying = (owner: string) => {
    const hit: Effect = { kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-c'), amount: 4, nature: 'normal' } };
    return harness(kwMode).run(table({ 'seat-a:hand': [card('r', 'shan', 'heart')] }, { owner, generals: at('seat-a', 'hua-tuo') }), [hit]);
  };

  it("outside his turn, uses a red card as a Peach to save a dying seat (he is asked without a Peach)", () => {
    const kw = harness(kwMode);
    let s = kw.pass(dying('seat-b')); // seat-c itself
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    s = kw.select(kw.convert(s, 'seat-a', 'first-aid'), 'r');
    expect(hp(s, 'seat-c')).toBe(1);
  });

  it('not in his own turn', () => {
    const kw = harness(kwMode);
    const s = kw.pass(dying('seat-a'));
    expect(s.seats[2].eliminated).toBe(true);
  });
});

describe('Hua Tuo — Green Vesicle', () => {
  it('discards 1 hand card; a hurt seat of his choice, himself included, recovers 1 HP; once per turn', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan'), card('k2', 'shan')] }, { generals: at('seat-a', 'hua-tuo'), hp: { 'seat-a': 2, 'seat-c': 3 } });
    s = h.select(h.useSkill(s, 'seat-a', 'green-vesicle'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-a', 'seat-c']);
    s = h.choose(s, 'seat-c');
    expect(hp(s, 'seat-c')).toBe(4);
    expect(offered(s, 'seat-a', 'green-vesicle')).toBe(false);
  });

  it('is not offered while nobody is hurt', () => {
    expect(offered(table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: at('seat-a', 'hua-tuo') }), 'seat-a', 'green-vesicle')).toBe(false);
  });
});

describe('Diao Chan — Sow Discord', () => {
  const her = (o: TableOptions = {}, cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('k', 'shan')], ...cards }, { ...o, generals: { ...at('seat-a', 'diao-chan'), ...o.generals } });

  it('discards 1 card and picks two other male seats: the second uses a Duel on the first', () => {
    let s = h.select(h.useSkill(her(), 'seat-a', 'sow-discord'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-b');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toEqual({ kind: 'CardPlayedEvent', seatId: 'seat-c', card: { as: 'duel', colour: 'none', physical: [] }, targets: [seat('seat-b')] });
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    const hit = h.pass(s);
    expect(hp(hit, 'seat-b')).toBe(3);
    expect(hit.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('seat-c') } });
  });

  it('is not offered without two other male seats', () => {
    expect(offered(her({ generals: { 'seat-c': ['filler-zhu-rong', 'filler-sun-jian'], 'seat-d': ['filler-cai-wenji', 'filler-sun-jian'] } }), 'seat-a', 'sow-discord')).toBe(false);
  });

  it('a seat the Duel can’t target (Empty City) is never the first pick', () => {
    const s = h.select(h.useSkill(her({ generals: { 'seat-b': ['zhuge-liang', 'filler-liu-shan'] } }), 'seat-a', 'sow-discord'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
  });
});

describe('Diao Chan — Eclipse the Moon', () => {
  it('draws 1 at the start of her End Phase', () => {
    const s = h.act(table({ drawPile: [card('d1', 'shan')] }, { generals: at('seat-a', 'diao-chan') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'eclipse-the-moon', outcome: 'used' })]);
  });
});
