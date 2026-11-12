import { policyById, policyIds, registerPolicy } from './policies';
import { ruleBasedPolicy, ruleBasedV1Policy, ruleBasedV3Policy, ruleBasedV4Policy, ruleBasedV5Policy, ruleBasedV6Policy, ruleBasedPicksKwPolicy, ruleBasedWastePolicy, ruleBasedWasteNoCPolicy } from './rule-based';
import { isAlly } from './helpers';
import { act, card, decide, decideWith, table } from './testing';

describe('policy registry', () => {
  it('lists the registered policies', () => {
    expect(policyIds().sort()).toEqual(['rule-based', 'rule-based-cards', 'rule-based-picks', 'rule-based-picks-kw', 'rule-based-responses', 'rule-based-v1', 'rule-based-v2', 'rule-based-v3', 'rule-based-v4', 'rule-based-v5', 'rule-based-v6', 'rule-based-waste', 'rule-based-waste-no-c']);
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

describe('rule-based-v4', () => {
  it('has the id "rule-based-v4"', () => expect(ruleBasedV4Policy.id).toBe('rule-based-v4'));

  const asRankedSeats = { generals: { 'seat-b': ['filler-sun-ce', 'filler-lu-su'] as [string, string] } };
  const fixtures: Record<string, () => ReturnType<typeof table>> = {
    'General selection': () => ({ ...table(), phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['cao-cao', 'sun-quan', 'liu-bei', 'guan-yu'] } } }),
    // The stub mode has no dying trigger, so the dying round is opened by hand: seat-b is at 0 HP and may play its Peach.
    'dying response': () => ({
      ...table({ 'seat-b:hand': [card('p1', 'peach')] }, { hp: { 'seat-b': 0 } }),
      pendingResponse: { id: 'dying-seat-b-0', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'], reason: { kind: 'dying', seatId: 'seat-b' }, context: { effect: { kind: 'DyingEffect', seatId: 'seat-b', order: ['seat-b'], rescueCardIds: { any: ['peach'], self: [] }, entering: false } } },
    }),
    'Discard Phase': () => ({ ...table({ 'seat-a:hand': ['a', 'b', 'c', 'd', 'e', 'f'].map((i, n) => card(i, n % 2 ? 'sha' : 'peach')) }), phase: 'Discard' }),
    'Play Phase with Sha and Steal': () => table({ 'seat-a:hand': [card('s1', 'sha'), card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-d:hand': [card('y', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } }),
    'Wuxie window': () => {
      const s = table({ 'seat-a:hand': [card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-c:hand': [card('w1', 'wuxie')] }, asRankedSeats);
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
  };
  // Each fixture must be the situation its name says, and v4 must make this decision in it.
  const setup: Record<string, (s: ReturnType<typeof table>) => boolean> = {
    'dying response': (s) => s.pendingResponse?.reason?.kind === 'dying',
    'Wuxie window': (s) => s.pendingResponse?.reason?.kind === 'wuxie' && s.pendingResponse.respondingSeatId === 'seat-c',
  };
  const expected: Record<string, object> = {
    'General selection': { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'liu-bei', deputyId: 'guan-yu' },
    'dying response': { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'dying-seat-b-0', cardInstanceId: 'p1' },
    'Discard Phase': { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'b' },
    'Play Phase with Sha and Steal': { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-d' }] },
    'Wuxie window': { kind: 'PassAction', seatId: 'seat-c', pendingResponseId: 'wuxie-check-2-seat-c-steal-t1-seat-b' },
  };
  it.each(Object.keys(fixtures))('pins the frozen v4 decision: %s', (name) => {
    const s = fixtures[name]();
    expect(setup[name]?.(s)).not.toBe(false);
    expect(decideWith(ruleBasedV4Policy, s)).toEqual(expected[name]);
  });
});

describe('rule-based-v5', () => {
  it('has the id "rule-based-v5"', () => expect(ruleBasedV5Policy.id).toBe('rule-based-v5'));
  it('the no-waste variant has the id "rule-based-waste"', () => expect(ruleBasedWastePolicy.id).toBe('rule-based-waste'));

  it('rule-based-waste-no-c answers the Sha like v5 (no rule C)', () => {
    const s = act(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('d1', 'shan')] }, { hp: { 'seat-b': 4 } }), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    expect(decideWith(ruleBasedWasteNoCPolicy, s)).toEqual(decideWith(ruleBasedV5Policy, s));
    expect(decideWith(ruleBasedWastePolicy, s)).not.toEqual(decideWith(ruleBasedV5Policy, s));
  });

  // v5 is 'rule-based' as it was at the start of Part 3, frozen: these were its decisions when Part 3 shipped.
  const fixtures: Record<string, () => ReturnType<typeof table>> = {
    'General selection': () => ({ ...table(), phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['cao-cao', 'sun-quan', 'liu-bei', 'guan-yu'] } } }),
    'dying response': () => ({
      ...table({ 'seat-b:hand': [card('p1', 'peach')] }, { hp: { 'seat-b': 0 } }),
      pendingResponse: { id: 'dying-seat-b-0', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'], reason: { kind: 'dying', seatId: 'seat-b' }, context: { effect: { kind: 'DyingEffect', seatId: 'seat-b', order: ['seat-b'], rescueCardIds: { any: ['peach'], self: [] }, entering: false } } },
    }),
    'Discard Phase': () => ({ ...table({ 'seat-a:hand': ['a', 'b', 'c', 'd', 'e', 'f'].map((i, n) => card(i, n % 2 ? 'sha' : 'peach')) }), phase: 'Discard' }),
    'Play Phase with Sha and Steal': () => table({ 'seat-a:hand': [card('s1', 'sha'), card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-d:hand': [card('y', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } }),
    'Wuxie window': () => {
      const s = table({ 'seat-a:hand': [card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-c:hand': [card('w1', 'wuxie')] }, { generals: { 'seat-b': ['filler-sun-ce', 'filler-lu-su'] as [string, string] } });
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
    // v5 answers every hit it can; the shipped bot at full HP and not exposed takes it and keeps its Shan (rule C3).
    'Shan to a Sha': () => {
      const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('d1', 'shan')] }, { hp: { 'seat-b': 4 } });
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
  };
  // Each fixture must be the situation its name says, and v5 must make this decision in it.
  const setup: Record<string, (s: ReturnType<typeof table>) => boolean> = {
    'dying response': (s) => s.pendingResponse?.reason?.kind === 'dying',
    'Wuxie window': (s) => s.pendingResponse?.reason?.kind === 'wuxie' && s.pendingResponse.respondingSeatId === 'seat-c',
    'Shan to a Sha': (s) => s.pendingResponse?.respondingSeatId === 'seat-b' && !!s.pendingResponse.allowedCardIds?.includes('shan'),
  };
  const expected: Record<string, object> = {
    'General selection': { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'liu-bei', deputyId: 'guan-yu' },
    'dying response': { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'dying-seat-b-0', cardInstanceId: 'p1' },
    'Discard Phase': { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'b' },
    'Play Phase with Sha and Steal': { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-d' }] },
    'Wuxie window': { kind: 'PassAction', seatId: 'seat-c', pendingResponseId: 'wuxie-check-2-seat-c-steal-t1-seat-b' },
    'Shan to a Sha': { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'sha-response-s1-seat-b-0', cardInstanceId: 'd1' },
  };
  it.each(Object.keys(fixtures))('pins the frozen v5 decision: %s', (name) => {
    const s = fixtures[name]();
    expect(setup[name]?.(s)).not.toBe(false);
    expect(decideWith(ruleBasedV5Policy, s)).toEqual(expected[name]);
  });
});

describe('rule-based-v6', () => {
  it('has the id "rule-based-v6"', () => expect(ruleBasedV6Policy.id).toBe('rule-based-v6'));
  it('the Kingdom Wars picks challenger has the id "rule-based-picks-kw"', () => expect(ruleBasedPicksKwPolicy.id).toBe('rule-based-picks-kw'));

  // v6 is 'rule-based' as it was at the start of Part 4, frozen: these were its decisions then.
  const fixtures: Record<string, () => ReturnType<typeof table>> = {
    'General selection': () => ({ ...table(), phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['cao-cao', 'sun-quan', 'liu-bei', 'guan-yu'] } } }),
    'dying response': () => ({
      ...table({ 'seat-b:hand': [card('p1', 'peach')] }, { hp: { 'seat-b': 0 } }),
      pendingResponse: { id: 'dying-seat-b-0', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'], reason: { kind: 'dying', seatId: 'seat-b' }, context: { effect: { kind: 'DyingEffect', seatId: 'seat-b', order: ['seat-b'], rescueCardIds: { any: ['peach'], self: [] }, entering: false } } },
    }),
    'Discard Phase': () => ({ ...table({ 'seat-a:hand': ['a', 'b', 'c', 'd', 'e', 'f'].map((i, n) => card(i, n % 2 ? 'sha' : 'peach')) }), phase: 'Discard' }),
    'Play Phase with Sha and Steal': () => table({ 'seat-a:hand': [card('s1', 'sha'), card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-d:hand': [card('y', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } }),
    'Wuxie window': () => {
      const s = table({ 'seat-a:hand': [card('t1', 'steal')], 'seat-b:hand': [card('x', 'sha')], 'seat-c:hand': [card('w1', 'wuxie')] }, { generals: { 'seat-b': ['filler-sun-ce', 'filler-lu-su'] as [string, string] } });
      return act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-b' }] } as never);
    },
  };
  // Each fixture must be the situation its name says.
  const setup: Record<string, (s: ReturnType<typeof table>) => boolean> = {
    'dying response': (s) => s.pendingResponse?.reason?.kind === 'dying',
    'Wuxie window': (s) => s.pendingResponse?.reason?.kind === 'wuxie' && s.pendingResponse.respondingSeatId === 'seat-c',
  };
  const expected: Record<string, object> = {
    'General selection': { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'liu-bei', deputyId: 'guan-yu' },
    'dying response': { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'dying-seat-b-0', cardInstanceId: 'p1' },
    'Discard Phase': { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'b' },
    'Play Phase with Sha and Steal': { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 't1', targets: [{ kind: 'seat', seatId: 'seat-d' }] },
    'Wuxie window': { kind: 'PassAction', seatId: 'seat-c', pendingResponseId: 'wuxie-check-2-seat-c-steal-t1-seat-b' },
  };
  it.each(Object.keys(fixtures))('pins the frozen v6 decision: %s', (name) => {
    const s = fixtures[name]();
    expect(setup[name]?.(s)).not.toBe(false);
    expect(decideWith(ruleBasedV6Policy, s)).toEqual(expected[name]);
  });
});
