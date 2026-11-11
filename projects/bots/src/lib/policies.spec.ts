import { policyById, policyIds, registerPolicy } from './policies';
import { ruleBasedPolicy, ruleBasedV1Policy, ruleBasedV3Policy } from './rule-based';
import { isAlly } from './helpers';
import { act, card, decide, decideWith, table } from './testing';
import type { GameState } from 'engine';

describe('policy registry', () => {
  it('lists the registered policies', () => {
    expect(policyIds().sort()).toEqual(['rule-based', 'rule-based-cards', 'rule-based-kw', 'rule-based-picks', 'rule-based-responses', 'rule-based-v1', 'rule-based-v2', 'rule-based-v3']);
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
    expect(() => policyById('nope')).toThrow(/Unknown bot policy "nope".*rule-based, rule-based-v1, rule-based-v2, rule-based-v3, rule-based-kw, rule-based-cards, rule-based-responses, rule-based-picks/);
  });
});

// Until the Kingdom Wars rules ship, 'rule-based-v3' must decide exactly as 'rule-based' does.
describe('rule-based-v3', () => {
  const dyingWindow = (): GameState => {
    const s = table({ 'seat-a:hand': [card('p1', 'peach', 'heart', 3)] }, { hp: { 'seat-a': 0 } });
    return {
      ...s,
      pendingResponse: {
        id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 0 } },
        reason: { kind: 'dying', seatId: 'seat-a' },
      },
    };
  };
  const wuxieWindow = (): GameState => {
    const s = table({ 'seat-a:hand': [card('wx', 'wuxie')] });
    return {
      ...s,
      pendingResponse: {
        id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 0 } },
        reason: { kind: 'wuxie', tool: { as: 'barbarians', colour: 'black', physical: [] }, toolUserSeatId: 'seat-b', target: { kind: 'seat', seatId: 'seat-a' } },
      },
    };
  };
  const generalSelection = (): GameState => ({
    ...table(),
    phase: 'GeneralSelection',
    generalSelection: { candidates: { 'seat-a': ['xu-huang', 'dong-zhuo', 'cao-pi', 'zhang-he'] } },
  });
  const discardPhase = (): GameState => ({
    ...table({ 'seat-a:hand': ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id, i) => card(id, i % 2 ? 'sha' : 'shan')) }),
    phase: 'Discard',
  });
  const shaAndSteal = (): GameState => table({ 'seat-a:hand': [card('s1', 'sha'), card('st1', 'steal', 'club', 3)] }, { hp: { 'seat-b': 3, 'seat-d': 2 } });
  const fixtures: Record<string, () => GameState> = { generalSelection, dyingWindow, discardPhase, shaAndSteal, wuxieWindow };

  it('has the id "rule-based-v3"', () => expect(ruleBasedV3Policy.id).toBe('rule-based-v3'));

  for (const [name, build] of Object.entries(fixtures)) {
    it(`decides as rule-based does: ${name}`, () => {
      const s = build();
      expect(decideWith(ruleBasedV3Policy, s)).toEqual(decideWith(ruleBasedPolicy, s));
    });
  }
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
