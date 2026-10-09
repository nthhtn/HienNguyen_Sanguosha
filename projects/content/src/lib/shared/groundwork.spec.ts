import type { AbilityModifiers, GameState } from 'engine';
import { usedCardOf } from 'engine';
import { card, harness, hp, ids, kwMode, registry, seat, table } from '../generals/skills.testing';
import { seatDistance } from './queries';
import { cardStep } from './steps';

// Test Generals with one compulsory modifier each (not in the real data).
const tester = (id: string, modifiers: AbilityModifiers) => registry.generals.set(id, { id, kingdom: 'Wei', maxHp: 4, skills: [{ id, compulsory: true, modifiers }] });
tester('test-rider', { distanceToOthers: -1 });
tester('test-reach', { toolsIgnoreDistance: true });
tester('test-humble', { untargetableBy: ['steal', 'capture'] });
tester('test-empty', { untargetableWithEmptyHandBy: ['sha', 'duel'] });
tester('test-matchless', { doubleAnswers: true });

const { legal, play, pass, respond, run } = harness();
const withA = (main: string, revealed = true) => ({ 'seat-a': [main, 'filler-dong-zhuo', revealed] as [string, string, boolean] });
const targetsOf = (s: GameState, cardId: string) =>
  legal(s, 'seat-a').flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));

describe('distanceToOthers', () => {
  it('brings every other seat 1 closer, never below 1, and is off while its General is hidden', () => {
    const s = table({}, { generals: withA('test-rider') });
    expect(seatDistance(s, 'seat-a', 'seat-c', registry)).toBe(1);
    expect(seatDistance(s, 'seat-a', 'seat-b', registry)).toBe(1);
    expect(seatDistance(s, 'seat-c', 'seat-a', registry)).toBe(2);
    expect(seatDistance(table({}, { generals: withA('test-rider', false) }), 'seat-a', 'seat-c', registry)).toBe(2);
  });
});

describe('toolsIgnoreDistance', () => {
  it('lets Steal reach a seat 2 away', () => {
    const cards = { 'seat-a:hand': [card('st', 'steal')], 'seat-c:hand': [card('x', 'shan')] };
    expect(targetsOf(table(cards), 'st')).not.toContain('seat-c');
    expect(targetsOf(table(cards, { generals: withA('test-reach') }), 'st')).toContain('seat-c');
  });
});

describe('untargetableBy', () => {
  it('keeps Steal and Capture off the seat', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('cp', 'capture', 'spade', 6)], 'seat-b:hand': [card('x', 'shan')] }, { generals: { 'seat-b': ['test-humble', 'filler-dong-zhuo'] } });
    expect(targetsOf(s, 'st')).not.toContain('seat-b');
    expect(targetsOf(s, 'cp')).not.toContain('seat-b');
  });

  it('with an empty hand only: Sha and Duel can’t target the seat', () => {
    const empty = table({ 'seat-a:hand': [card('s1', 'sha'), card('d1', 'duel')] }, { generals: { 'seat-b': ['test-empty', 'filler-dong-zhuo'] } });
    expect(targetsOf(empty, 's1')).not.toContain('seat-b');
    expect(targetsOf(empty, 'd1')).not.toContain('seat-b');
    const holding = table({ 'seat-a:hand': [card('s1', 'sha'), card('d1', 'duel')], 'seat-b:hand': [card('x', 'peach')] }, { generals: { 'seat-b': ['test-empty', 'filler-dong-zhuo'] } });
    expect(targetsOf(holding, 's1')).toContain('seat-b');
    expect(targetsOf(holding, 'd1')).toContain('seat-b');
  });
});

describe('doubleAnswers', () => {
  const shan = [card('n1', 'shan'), card('n2', 'shan', 'heart')];

  it('a Sha needs two Shan: one is not enough', () => {
    let s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': shan }, { generals: withA('test-matchless') }), 's1', 'seat-b');
    s = respond(s, 'n1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(pass(s), 'seat-b')).toBe(3);
    expect(hp(respond(s, 'n2'), 'seat-b')).toBe(4);
  });

  it('in a Duel, the other seat plays two Sha each time before it turns back', () => {
    let s = play(table({ 'seat-a:hand': [card('d1', 'duel')], 'seat-b:hand': [card('b1', 'sha'), card('b2', 'sha')] }, { generals: withA('test-matchless') }), 'd1', 'seat-b');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    s = respond(s, 'b1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    s = respond(s, 'b2');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    expect(hp(pass(s), 'seat-a')).toBe(3);
  });
});

describe('an unblockable Sha', () => {
  it('goes from its armour check straight to the hit: no Shan is asked for', () => {
    const sha = usedCardOf(card('s1', 'sha'));
    const s = run(table({ 'seat-b:hand': [card('n1', 'shan')] }), [cardStep('sha-armor', sha, 'seat-a', seat('seat-b'), { extra: 0, unblockable: true })]);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
  });
});

describe('a Duel with no physical card', () => {
  it('runs its windows and deals damage caused by the Duel as used', () => {
    const virtual = { as: 'duel', colour: 'none' as const, physical: [] };
    const s = run(table(), [{ kind: 'UseCardEffect', seatId: 'seat-b', card: virtual, targets: [seat('seat-c')] }]);
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-c');
    const hit = pass(s);
    expect(hp(hit, 'seat-c')).toBe(3);
    expect(hit.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('seat-b'), cause: { card: virtual } } });
  });
});

describe('Lightning', () => {
  it('goes to the discard pile before its 3 damage, which names it as the cause', () => {
    const bolt = card('li', 'lightning', 'spade', 1);
    // Kingdom War's own triggers judge the Judgment slot.
    const s = harness(kwMode).settle(table({ 'seat-a:judgment': [bolt], drawPile: [card('j', 'shan', 'spade', 5), ...Array.from({ length: 4 }, (_, i) => card(`p${i}`, 'shan', 'heart'))] }, { phase: 'Start' }));
    const moved = s.log.findIndex((e) => e.kind === 'CardMovedEvent' && e.cardInstanceId === 'li' && e.toZoneId === 'discardPile');
    const damaged = s.log.findIndex((e) => e.kind === 'DamageDealtEvent');
    expect(moved).toBeGreaterThan(-1);
    expect(moved).toBeLessThan(damaged);
    expect(s.log[damaged]).toMatchObject({ damage: { amount: 3, cause: { cardInstanceId: 'li', card: { as: 'lightning' } } } });
  });
});

describe('a card that counts as a delayed Tool', () => {
  // A diamond Shan lying in seat-a's Judgment slot as a Capture.
  const placed = (judgedSuit: 'heart' | 'club') => {
    const s = table({ 'seat-a:judgment': [card('c1', 'shan', 'diamond', 3)], drawPile: [card('j', 'sha', judgedSuit, 9), ...Array.from({ length: 4 }, (_, i) => card(`p${i}`, 'shan'))] }, { phase: 'Start' });
    return { ...s, zones: s.zones.map((z) => (z.id === 'seat-a:judgment' ? { ...z, countsAs: { c1: 'capture' } } : z)) };
  };

  it('is judged as that Tool in the Judgment Phase', () => {
    const { settle: kwSettle } = harness(kwMode);
    const spared = kwSettle(placed('heart'));
    expect(spared.log.find((e) => e.kind === 'JudgmentEvent')).toMatchObject({ reader: { kind: 'card', card: { as: 'capture' } } });
    expect(spared.phase).toBe('Play');
    const captured = kwSettle(placed('club'));
    expect(captured.log.some((e) => e.kind === 'PhaseSkippedEvent' && e.phase === 'Play')).toBe(true);
    expect(ids(captured, 'seat-a:judgment')).toEqual([]);
  });

  it('counts as one already held: a second Capture can’t be placed there', () => {
    const s = { ...placed('heart'), phase: 'Play' as const, turn: { turnNumber: 1, ownerSeatId: 'seat-b', extraTurnStack: [] } };
    const withCapture = { ...s, zones: s.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [card('cp', 'capture', 'spade', 6)] } : z)) };
    const offers = legal(withCapture, 'seat-b').flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === 'cp' ? [a.targets[0]?.seatId] : []));
    expect(offers).not.toContain('seat-a');
  });
});
