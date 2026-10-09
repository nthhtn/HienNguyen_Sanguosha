import type { Effect, GameState } from 'engine';
import { asking, card, decide, general, picked, table } from './testing';

const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

describe('Wind skills: asks', () => {
  it('Entrench with 2 or fewer cards at 3 HP or more and no hurt ally; not otherwise', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('x', 'shan')] }), 'entrench')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': ['a', 'b', 'c'].map((id) => card(id, 'shan')) }), 'entrench')))).toBe('decline');
    expect(picked(decide(asking(table({}, { hp: { 'seat-a': 2 } }), 'entrench')))).toBe('decline');
  });

  it('Godspeed at the Start: with an empty Judgment slot and a non-ally at 2 HP or less', () => {
    const start = (hpB: number) => ({ ...asking(table({}, { hp: { 'seat-b': hpB } }), 'godspeed'), phase: 'Start' as const });
    expect(picked(decide(start(2)))).toBe('use');
    expect(picked(decide(start(4)))).toBe('decline');
  });

  it('Strong Bow on a non-ally; Refusing Death and Lightning Strike always', () => {
    expect(picked(decide(asking(table(), 'strong-bow', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'strong-bow', 'seat-b')))).toBe('decline');
    expect(picked(decide(asking(table(), 'refusing-death')))).toBe('use');
    expect(picked(decide(asking(table(), 'lightning-strike')))).toBe('use');
  });

  it('Fantasy with a spare heart when the damage would leave it at 2 HP or less', () => {
    const damage: Effect = { kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-a'), amount: 2, nature: 'normal' } };
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('h', 'shan', 'heart')] }), 'fantasy', undefined, [damage])))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('p', 'peach', 'heart')] }), 'fantasy', undefined, [damage])))).toBe('decline');
  });
});

describe('Wind skills: picks', () => {
  const pick = (abilityId: string, targetSeatId?: string, cardId?: string, labels?: string[]): GameState => ({
    ...table({}, { hp: { 'seat-c': 2 } }),
    pendingChoice: {
      id: 'p', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general(cardId ? 'seat-b' : 'seat-a', abilityId), abilityId, ...(targetSeatId ? { targetSeatId } : {}), ...(cardId ? { cardId } : {}) },
      options: labels
        ? labels.map((id) => ({ id, shows: { kind: 'label' as const, text: id }, effects: [] }))
        : ['seat-b', 'seat-c', 'seat-d'].map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    },
  });

  it('Godspeed, Fantasy and Lightning Strike aim at the weakest non-ally', () => {
    for (const id of ['godspeed', 'fantasy', 'lightning-strike']) expect(picked(decide(pick(id)))).toBe('seat-c');
  });

  it('Believe or Doubt: an ally believes; a non-ally doubts a Sha, Peach or Wuxie at 3 HP or more', () => {
    expect(picked(decide(pick('bewilder', undefined, 'sha', ['believe', 'doubt'])))).toBe('doubt');
    expect(picked(decide(pick('bewilder', undefined, 'draw-two', ['believe', 'doubt'])))).toBe('believe');
    const ally = { ...pick('bewilder', undefined, 'sha', ['believe', 'doubt']) };
    ally.seats = ally.seats.map((s) => (s.id === 'seat-b' ? { ...s, kingdom: 'Wei' as const } : s));
    expect(picked(decide(ally))).toBe('believe');
  });
});

describe('Bewilder as Yu Ji', () => {
  it('bluffs only with more than 4 cards', () => {
    const yuJi = (n: number) => table({ 'seat-a:hand': Array.from({ length: n }, (_, i) => card(`x${i}`, 'shan', 'club', i + 2)) }, { generals: { 'seat-a': ['yu-ji', 'filler-zuo-ci'] }, kingdoms: { 'seat-a': 'Qun' } });
    expect(decide(yuJi(3)).kind).toBe('EndPhaseAction');
    expect(decide(yuJi(5))).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: expect.stringMatching(/^bewilder-/) } });
  });
});
