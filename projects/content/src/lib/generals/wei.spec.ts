import type { Effect, GameState } from 'engine';
import { skillsInPlay, usedCardFrom } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, registry, seat, table, TableOptions } from './skills.testing';

const { play, pass, run, use, decline, choose, select, cancel } = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'xiahou-yuan', revealed] });
// seat-b's turn: it plays Sha s1 at seat-a, which doesn't dodge.
const shaHits = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions) =>
  pass(play(table({ ...cards, 'seat-b:hand': [card('s1', 'sha'), ...(cards['seat-b:hand'] ?? [])] }, { owner: 'seat-b', ...o }), 's1', 'seat-a'));
const damage = (amount: number, cause?: Extract<Effect, { kind: 'DamageEffect' }>['damage']['cause']): Effect => ({
  kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-a'), amount, nature: 'normal', ...(cause ? { cause } : {}) },
});

describe('Cao Cao — Evil Hero', () => {
  it('may take the card that damaged him into his hand', () => {
    const s = shaHits({}, { generals: at('seat-a', 'cao-cao') });
    expect(askedAbout(s)).toBe('evil-hero');
    expect(handIds(use(s), 'seat-a')).toEqual(['s1']);
    expect(ids(decline(s), 'discardPile')).toEqual(['s1']);
  });

  it('takes both cards of a Serpent Spear Sha', () => {
    const [c1, c2] = [card('c1', 'peach', 'heart'), card('c2', 'shan', 'spade')];
    const s = run(table({ discardPile: [c1, c2] }, { generals: at('seat-a', 'cao-cao') }), [damage(1, { cardInstanceId: 'c1', card: usedCardFrom([c1, c2], 'sha') })]);
    expect(handIds(use(s), 'seat-a')).toEqual(['c1', 'c2']);
  });

  it('is not asked when the card has left the discard pile and processing, or for damage with no card', () => {
    const c1 = card('c1', 'sha');
    expect(run(table({ 'seat-c:hand': [c1] }, { generals: at('seat-a', 'cao-cao') }), [damage(1, { cardInstanceId: 'c1', card: usedCardFrom([c1], 'sha') })]).pendingChoice).toBeUndefined();
    expect(run(table({}, { generals: at('seat-a', 'cao-cao') }), [damage(1, { skillId: 'unyielding' })]).pendingChoice).toBeUndefined();
  });

  it('hidden: asked as a reveal; Use reveals Cao Cao, then takes the card', () => {
    const s = shaHits({}, { generals: at('seat-a', 'cao-cao', false) });
    expect(s.pendingChoice?.options[0].shows).toEqual({ kind: 'use', reveals: 'main' });
    const taken = use(s);
    expect(taken.seats[0].generals!.main.revealed).toBe(true);
    expect(taken.log.find((e) => e.kind === 'GeneralRevealedEvent')).toMatchObject({ seatId: 'seat-a', forAbilityId: 'evil-hero' });
    expect(handIds(taken, 'seat-a')).toEqual(['s1']);
  });

  it('Escort is a Lord skill: never in play', () => {
    expect(skillsInPlay(table({}, { generals: at('seat-a', 'cao-cao') }), 'seat-a', registry).map((s) => s.skill.id)).toEqual(['evil-hero']);
  });
});

describe('Sima Yi — Feedback', () => {
  it('may take one of the damaging seat’s cards: its hand face down, or a worn card', () => {
    const s = shaHits({ 'seat-b:hand': [card('x1', 'shan')], 'seat-b:equip': [card('cb', 'crossbow', 'club', 1)] }, { generals: at('seat-a', 'sima-yi') });
    expect(askedAbout(s)).toBe('feedback');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-b' });
    const picking = use(s);
    expect(picking.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'take' });
    expect(picking.pendingChoice!.options.map((o) => o.id)).toEqual(['hand', 'cb']);
    const took = choose(picking, 'cb');
    expect(handIds(took, 'seat-a')).toEqual(['cb']);
    expect(handIds(choose(picking, 'hand'), 'seat-a')).toEqual(['x1']);
  });

  it('is not asked when the source holds nothing it could take, or there is no source', () => {
    expect(shaHits({ 'seat-b:judgment': [card('cp', 'capture')] }, { generals: at('seat-a', 'sima-yi') }).pendingChoice).toBeUndefined();
    const noSource: Effect = { kind: 'DamageEffect', damage: { source: null, target: seat('seat-a'), amount: 1, nature: 'normal' } };
    expect(run(table({}, { generals: at('seat-a', 'sima-yi') }), [noSource]).pendingChoice).toBeUndefined();
  });
});

describe('Xiahou Dun — Unyielding', () => {
  const judged = (suit: 'spade' | 'heart', bHand: ReturnType<typeof card>[]) =>
    use(shaHits({ drawPile: [card('j', 'sha', suit, 9)], 'seat-b:hand': bHand }, { generals: at('seat-a', 'xiahou-dun') }));
  const twoCards = [card('x1', 'shan'), card('x2', 'peach', 'heart')];

  it('on a judgment that is not a heart, the damaging seat discards 2 hand cards or takes 1 damage', () => {
    const s = judged('spade', twoCards);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick' });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Discard 2 Hand Cards' }, { kind: 'label', text: 'Take 1 Damage' }]);
    const hurt = choose(s, 'damage');
    expect(hp(hurt, 'seat-b')).toBe(3);
    expect(hurt.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: seat('seat-a'), cause: { skillId: 'unyielding' } } });
    const discarding = choose(s, 'discard');
    expect(discarding.pendingSelection).toMatchObject({ seatId: 'seat-b', min: 2, max: 2 });
    expect(discarding.pendingSelection!.onCancel).toBeUndefined();
    const discarded = select(discarding, 'x1', 'x2');
    expect(handIds(discarded, 'seat-b')).toEqual([]);
    expect(hp(discarded, 'seat-b')).toBe(4);
  });

  it('a heart does nothing; with fewer than 2 hand cards the seat must take the damage', () => {
    const heart = judged('heart', twoCards);
    expect(heart.pendingChoice).toBeUndefined();
    expect(hp(heart, 'seat-b')).toBe(4);
    const short = judged('spade', [card('x1', 'shan')]);
    expect(short.pendingChoice).toBeUndefined();
    expect(hp(short, 'seat-b')).toBe(3);
  });

  it('the judged card ends in the discard pile', () => {
    expect(ids(choose(judged('spade', twoCards), 'damage'), 'discardPile')).toContain('j');
  });
});

describe('Guo Jia — Bestowed Rouse', () => {
  const draws = Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
  const hit = (amount: number) => run(table({ drawPile: draws }, { generals: at('seat-a', 'guo-jia') }), [damage(amount)]);

  it('asks once per point of damage; each Use draws 2, which he may give away in any split', () => {
    let s = hit(2);
    expect(askedAbout(s)).toBe('bestowed-rouse');
    s = use(s);
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', eligibleIds: ['d1', 'd2'], min: 1, max: 2, then: { kind: 'give' } });
    s = choose(select(s, 'd1'), 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
    expect(s.pendingSelection?.eligibleIds).toEqual(['d2']);
    s = cancel(s); // keep the rest
    expect(askedAbout(s)).toBe('bestowed-rouse'); // the second point of damage
    s = decline(s);
    expect(handIds(s, 'seat-a')).toEqual(['d2']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('giving both drawn cards ends the giving', () => {
    const s = choose(select(use(hit(1)), 'd1', 'd2'), 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['d1', 'd2']);
    expect(s.pendingSelection).toBeUndefined();
  });
});
