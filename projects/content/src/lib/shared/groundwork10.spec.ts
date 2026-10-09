import type { SkillDefinition } from 'engine';
import { card, harness, kwMode, registry, table } from '../generals/skills.testing';
import { answersNeededAgainst, peachLockedTo, rangeBonusFor, untargetableBy } from './abilities';

const h = harness();
const kw = harness(kwMode);

// Test-only Generals carrying one modifier each. They live only in this spec's
// registry, so the fillers every table seats stay vanilla.
const testGeneral = (id: string, modifiers: NonNullable<SkillDefinition['modifiers']>) =>
  registry.generals.set(id, { id, kingdom: 'Wei', maxHp: 4, skills: [{ id: `skill-${id}`, compulsory: true, modifiers }] });
const withGeneral = (main: string, revealed = true) => table({}, { generals: { 'seat-a': [main, 'filler-jiang-wei', revealed] } });

beforeAll(() => {
  testGeneral('t-range', { rangeBonusFor: { starvation: 1 } });
  testGeneral('t-black', { untargetableByBlackTools: true });
  testGeneral('t-garden', { doubleAnswersWithFemale: true });
  testGeneral('t-peach', { peachOnlyOwnerAndDying: true });
});

describe('the new modifiers', () => {
  it('rangeBonusFor sums the bonus for that card', () => {
    const s = withGeneral('t-range');
    expect(rangeBonusFor(s, 'seat-a', 'starvation', registry)).toBe(1);
    expect(rangeBonusFor(s, 'seat-a', 'capture', registry)).toBe(0);
    expect(rangeBonusFor(s, 'seat-b', 'starvation', registry)).toBe(0);
  });

  it('untargetableBy with a black colour: a Tool, not a Basic card', () => {
    const s = withGeneral('t-black');
    expect(untargetableBy(s, 'seat-a', 'duel', registry, 'black')).toBe(true);
    expect(untargetableBy(s, 'seat-a', 'duel', registry, 'red')).toBe(false);
    expect(untargetableBy(s, 'seat-a', 'duel', registry)).toBe(false);
    expect(untargetableBy(s, 'seat-a', 'sha', registry, 'black')).toBe(false);
  });

  it('a hidden General has no modifiers', () => {
    expect(untargetableBy(withGeneral('t-black', false), 'seat-a', 'duel', registry, 'black')).toBe(false);
  });

  it('answersNeededAgainst: two against a female when either seat has Garden of Lust', () => {
    const s = table({}, { generals: { 'seat-a': ['t-garden', 'filler-jiang-wei'], 'seat-b': ['diao-chan', 'filler-jiang-wei'] } });
    expect(answersNeededAgainst(s, 'seat-a', registry, 'seat-b')).toBe(2); // the owner attacks a female
    expect(answersNeededAgainst(s, 'seat-b', registry, 'seat-a')).toBe(2); // a female attacks the owner
    expect(answersNeededAgainst(s, 'seat-a', registry, 'seat-c')).toBe(1); // a male
    expect(answersNeededAgainst(s, 'seat-a', registry)).toBe(1);
  });

  it('peachLockedTo names the turn owner while its Complete Kill is in play', () => {
    expect(peachLockedTo(withGeneral('t-peach'), registry)).toBe('seat-a');
    expect(peachLockedTo(withGeneral('t-peach', false), registry)).toBeNull();
    expect(peachLockedTo(table({}), registry)).toBeNull();
  });
});

describe('Starvation range', () => {
  it('a +1 range bonus reaches distance 2', () => {
    const hand = { 'seat-a:hand': [card('st', 'starvation', 'club', 3)] };
    const reach = (generals: string) => h.legal(table(hand, { generals: { 'seat-a': [generals, 'filler-jiang-wei'] } }), 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'st').map((a) => (a.kind === 'PlayCardAction' ? a.targets[0].seatId : ''));
    expect(reach('filler-xu-huang')).toEqual(['seat-b', 'seat-d']);
    expect(reach('t-range')).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });
});

describe('Dying order under Complete Kill', () => {
  const hit = (seatId: string) => ({ kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId }, amount: 1, nature: 'normal' as const, cause: {} } });
  const peachAt = (generals: Record<string, [string, string, boolean?]>) =>
    table({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] }, { generals, hp: { 'seat-b': 1 } });

  it('without it, the Peach holder is asked after the dying seat passes', () => {
    let s = kw.run(peachAt({}), [hit('seat-b')]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });

  it('with it, only the turn owner and the dying seat are asked', () => {
    let s = kw.run(peachAt({ 'seat-a': ['t-peach', 'filler-jiang-wei'] }), [hit('seat-b')]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.pendingResponse).toBeNull();
    expect(s.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
  });
});
