import { policyById, policyIds, registerPolicy } from './policies';
import { ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';
import { act, card, decide, table } from './testing';

describe('policy registry', () => {
  it('lists the registered policies', () => {
    expect(policyIds().sort()).toEqual(['rule-based', 'rule-based-cards', 'rule-based-picks', 'rule-based-responses', 'rule-based-v1', 'rule-based-v2']);
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
    expect(() => policyById('nope')).toThrow(/Unknown bot policy "nope".*rule-based, rule-based-v1, rule-based-v2, rule-based-cards, rule-based-responses, rule-based-picks/);
  });
});

describe('rule-based-v1', () => {
  it('has the id "rule-based-v1" and aims a Slash at the weakest non-ally in reach', () => {
    expect(ruleBasedV1Policy.id).toBe('rule-based-v1');
    // seat-a (Wei) reaches seat-b and seat-d (adjacent); seat-d has the lower HP.
    const state = table({ 'seat-a:hand': [card('s1', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } });
    const action = decide(state);
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-d' }] });
    expect(act(state, action)).toBeDefined();
  });
});
