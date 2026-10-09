import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'sun-jian', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Da Qiao — Displace', () => {
  // seat-b's Sha at Da Qiao (seat-a). Her neighbours are seat-b and seat-d.
  const shaAtHer = (cards: Record<string, ReturnType<typeof card>[]>) =>
    h.play(table({ 'seat-b:hand': [card('s1', 'sha')], ...cards }, { owner: 'seat-b', generals: at('seat-a', 'da-qiao') }), 's1', 'seat-a');

  it('discards 1 card to move the Sha onto another seat in her attack range, not its user; it goes on from the armour check', () => {
    let s = shaAtHer({ 'seat-a:hand': [card('x', 'peach', 'heart')] });
    expect(askedAbout(s)).toBe('displace');
    s = h.select(h.use(s), 'x');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-d']);
    s = h.choose(s, 'seat-d');
    expect(ids(s, 'discardPile')).toContain('x');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', allowedCardIds: ['shan'] });
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'displace', outcome: 'moved', targetSeatId: 'seat-d' })]);
    expect(hp(h.pass(s), 'seat-d')).toBe(3);
  });

  it('range is worked out after the discard: a horse she needs to reach the seat is not offered', () => {
    const horses = { 'seat-a:equip': [card('oh', 'red-hare', 'heart', 5)], 'seat-d:equip': [card('dh', 'di-lu', 'club', 5)] };
    const s = h.use(shaAtHer({ 'seat-a:hand': [card('x', 'shan')], ...horses }));
    expect(s.pendingSelection?.eligibleIds).toEqual(['x']);
    expect(shaAtHer(horses).pendingChoice).toBeUndefined(); // the horse is all she has: no ask
  });

  it('Cancel at the discard lets the Sha go on against her', () => {
    const s = h.cancel(h.use(shaAtHer({ 'seat-a:hand': [card('x', 'shan')] })));
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
  });
});

describe('Huang Gai — Battered Body', () => {
  it('loses 1 HP, then draws 2, any number of times', () => {
    let s = h.useSkill(table({ drawPile: pile }, { generals: at('seat-a', 'huang-gai') }), 'seat-a', 'battered-body');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
    expect(s.log.find((e) => e.kind === 'HpLostEvent')).toEqual({ kind: 'HpLostEvent', seatId: 'seat-a', amount: 1, abilityId: 'battered-body' });
    expect(offered(s, 'seat-a', 'battered-body')).toBe(true);
  });

  it('if it leaves him dying, the dying round comes first; he draws only if he survives', () => {
    const kw = harness(kwMode);
    const atOne = (hand: ReturnType<typeof card>[]) => kw.useSkill(table({ drawPile: pile, 'seat-a:hand': hand }, { generals: at('seat-a', 'huang-gai'), hp: { 'seat-a': 1 } }), 'seat-a', 'battered-body');
    const dying = atOne([card('pe', 'peach', 'heart')]);
    expect(dying.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
    const saved = kw.respond(dying, 'pe');
    expect(hp(saved, 'seat-a')).toBe(1);
    expect(handIds(saved, 'seat-a')).toEqual(['d1', 'd2']);
    const gone = kw.pass(atOne([]));
    expect(gone.seats[0].eliminated).toBe(true);
    expect(gone.log.some((e) => e.kind === 'CardsDrawnEvent' && e.seatId === 'seat-a')).toBe(false);
  });
});

describe('Sun Quan — Reconsider', () => {
  const sunQuan = () => table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'sha')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)], drawPile: pile }, { generals: at('seat-a', 'sun-quan') });

  it('discards any number of hand or worn cards, then draws that many; once per turn', () => {
    let s = h.useSkill(sunQuan(), 'seat-a', 'reconsider');
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['k1', 'k2', 'cb'], min: 1, max: 3 });
    s = h.select(s, 'k1', 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['k2', 'd1', 'd2']);
    expect(ids(s, 'discardPile')).toEqual(['k1', 'cb']);
    expect(offered(s, 'seat-a', 'reconsider')).toBe(false);
  });

  it('Cancel leaves it unused', () => {
    expect(offered(h.cancel(h.useSkill(sunQuan(), 'seat-a', 'reconsider')), 'seat-a', 'reconsider')).toBe(true);
  });
});

describe('Sun Shangxiang — Marriage', () => {
  // Hurt: seat-b (male), seat-c (female: Xiao Qiao), seat-d (both Generals hidden: no gender).
  const her = (hand = [card('k1', 'shan'), card('k2', 'sha')]) =>
    table({ 'seat-a:hand': hand }, {
      generals: { ...at('seat-a', 'sun-shangxiang'), 'seat-c': ['zhu-rong', 'sun-jian'], 'seat-d': ['xu-huang', 'dong-zhuo', false] },
      hp: { 'seat-a': 2, 'seat-b': 2, 'seat-c': 2, 'seat-d': 2 },
    });

  it('discards 2 hand cards and chooses a hurt male seat; both recover 1 HP', () => {
    let s = h.select(h.useSkill(her(), 'seat-a', 'marriage'), 'k1', 'k2');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b']);
    s = h.choose(s, 'seat-b');
    expect([hp(s, 'seat-a'), hp(s, 'seat-b')]).toEqual([3, 3]);
    expect(offered(s, 'seat-a', 'marriage')).toBe(false);
  });

  it('is not offered with fewer than 2 hand cards, or no hurt male seat', () => {
    expect(offered(her([card('k1', 'shan')]), 'seat-a', 'marriage')).toBe(false);
    const healthy = table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'sha')] }, { generals: at('seat-a', 'sun-shangxiang'), hp: { 'seat-a': 2 } });
    expect(offered(healthy, 'seat-a', 'marriage')).toBe(false);
  });
});

describe('Zhou Yu — Sow Revolt', () => {
  const zhouYu = (taken: ReturnType<typeof card>) => table({ 'seat-a:hand': [taken] }, { generals: at('seat-a', 'zhou-yu') });
  const revolt = (taken: ReturnType<typeof card>, named: string) => {
    let s = h.select(h.useSkill(zhouYu(taken), 'seat-a', 'sow-revolt'), 'seat-b');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick' });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual(['spade', 'heart', 'club', 'diamond'].map((suit) => ({ kind: 'suit', suit })));
    s = h.choose(s, named);
    return s;
  };

  it('the chosen seat names a suit, takes a random hand card of his, shown to all; a different suit costs it 1 damage', () => {
    const s = revolt(card('t', 'sha', 'spade'), 'heart');
    expect(handIds(s, 'seat-b')).toEqual(['t']);
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toEqual({ kind: 'CardShownEvent', seatId: 'seat-b', card: card('t', 'sha', 'spade'), abilityId: 'sow-revolt' });
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('the right suit: no damage', () => {
    expect(hp(revolt(card('t', 'sha', 'spade'), 'spade'), 'seat-b')).toBe(4);
  });

  it('needs a hand card, and is once per turn', () => {
    expect(offered(table({}, { generals: at('seat-a', 'zhou-yu') }), 'seat-a', 'sow-revolt')).toBe(false);
    expect(offered(revolt(card('t', 'sha', 'spade'), 'spade'), 'seat-a', 'sow-revolt')).toBe(false);
  });
});

describe('Displace after Iron Cavalry (final review #3)', () => {
  it('the new target may still play a Shan: Iron Cavalry was about Da Qiao', () => {
    // Ma Chao (seat-a, asked first) at Da Qiao (seat-b); Iron Cavalry judges red; Da Qiao moves the Sha to seat-c.
    let s = h.play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('x', 'peach', 'heart')], drawPile: [card('j', 'shan', 'heart', 2)] }, { generals: { 'seat-a': ['ma-chao', 'meng-huo'], ...at('seat-b', 'da-qiao') } }),
      's1', 'seat-b'
    );
    expect(askedAbout(s)).toBe('iron-cavalry');
    s = h.use(s);
    expect(askedAbout(s)).toBe('displace');
    s = h.choose(h.select(h.use(s), 'x'), 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
  });
});
