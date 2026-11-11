import { policyById, policyIds, registerPolicy } from './policies';
import { ruleBasedPolicy, ruleBasedV1Policy, ruleBasedV3Policy, ruleBasedV4Policy } from './rule-based';
import { isAlly } from './helpers';
import { act, card, decide, decideWith, table } from './testing';

describe('policy registry', () => {
  it('lists the registered policies', () => {
    expect(policyIds().sort()).toEqual(['rule-based', 'rule-based-cards', 'rule-based-picks', 'rule-based-responses', 'rule-based-table', 'rule-based-v1', 'rule-based-v2', 'rule-based-v3', 'rule-based-v4']);
  });

  it('looks a policy up by id', () => {
    expect(policyById('rule-based')).toBe(ruleBasedPolicy);
    expect(policyById('rule-based-v1')).toBe(ruleBasedV1Policy);
    expect(policyById('rule-based-cards').id).toBe('rule-based-cards');
  });

  it('registers a new policy under its id, and a later registration replaces it', () => {
    registerPolicy({ id: 'test-only', decide: ruleBasedPolicy.decide });
    expect(policyIds()).toContain('test-only');
    const replacement = { id: 'test-only', decide: ruleBasedV1Policy.decide };
    registerPolicy(replacement);
    expect(policyById('test-only')).toBe(replacement);
  });

  it('names the valid ids when the id is unknown', () => {
    expect(() => policyById('nope')).toThrow(/Unknown bot policy "nope".*rule-based, rule-based-v1, rule-based-v2, rule-based-v3, rule-based-cards, rule-based-responses, rule-based-picks/);
  });
});

describe('rule-based-v3', () => {
  it('has the id "rule-based-v3"', () => expect(ruleBasedV3Policy.id).toBe('rule-based-v3'));
});

describe('rule-based-v1', () => {
  it('has the id "rule-based-v1" and aims a Slash at the weakest non-ally in reach', () => {
    expect(ruleBasedV1Policy.id).toBe('rule-based-v1');
    // seat-a (Wei) reaches seat-b and seat-d (adjacent); seat-d has the lower HP.
    const state = table({ 'seat-a:hand': [card('s1', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } });
    const action = decide(state);
    expect(action).toMatchObject({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-d' }] });
    expect(act(state, action)).toBeDefined();
  });
});

describe('isAlly and Ambitionists', () => {
  const view = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei' } });
  const [a, b] = view.seats;
  it('same-Kingdom seats are allies', () => {
    expect(isAlly(a, b, view)).toBe(true);
  });
  it('an Ambitionist is nobody\'s ally, and nobody is its ally', () => {
    expect(isAlly({ ...a, allegiance: 'ambitionist' }, b, view)).toBe(false);
    expect(isAlly(a, { ...b, allegiance: 'ambitionist' }, view)).toBe(false);
  });
});

describe('rule-based-v4', () => {
  it('has the id "rule-based-v4"', () => expect(ruleBasedV4Policy.id).toBe('rule-based-v4'));

  const asRankedSeats = { generals: { 'seat-b': ['filler-sun-ce', 'filler-lu-su'] as [string, string] } };
  const fixtures: Record<string, () => ReturnType<typeof table>> = {
    'General selection': () => ({ ...table(), phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['cao-cao', 'sun-quan', 'liu-bei', 'guan-yu'] } } }),
    'dying response': () => {
      const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('p1', 'peach')] }, { hp: { 'seat-b': 1 } });
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
    'Discard Phase': () => ({ ...table({ 'seat-a:hand': ['a', 'b', 'c', 'd', 'e', 'f'].map((i, n) => card(i, n % 2 ? 'sha' : 'peach')) }), phase: 'Discard' }),
    'Play Phase with Sha and Steal': () => table({ 'seat-a:hand': [card('s1', 'sha'), card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-d:hand': [card('y', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } }),
    'Wuxie window': () => {
      const s = table({ 'seat-a:hand': [card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-c:hand': [card('w1', 'wuxie')] }, asRankedSeats);
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
  };
  it.each(Object.keys(fixtures))('decides as rule-based does: %s', (name) => {
    const s = fixtures[name]();
    if (name === 'dying response' || name === 'Wuxie window') expect(s.pendingResponse).not.toBeNull();
    expect(decideWith(ruleBasedV4Policy, s)).toEqual(decideWith(ruleBasedPolicy, s));
  });
});
