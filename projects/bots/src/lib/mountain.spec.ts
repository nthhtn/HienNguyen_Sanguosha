import { getLegalActions } from 'engine';
import type { GameState } from 'engine';
import { wantsMountainActive } from './mountain';
import { act, asking, card, decide, general, picked, registry, table } from './testing';

// The Mountain Generals' bot rules (stage 11 spec, "Bots").

const generals = (a: string, extra: Record<string, [string, string]> = {}) => ({ 'seat-a': [a, 'filler-jiang-wei'] as [string, string], ...extra });
const cards = (p: string, n: number) => Array.from({ length: n }, (_, i) => card(`${p}${i}`, 'shan', 'heart', i + 1));
const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } as const;
const choiceOf = (s: GameState, options: string[], abilityId: string, verb: 'pick' | 'give' | 'discard' = 'pick') => ({
  ...s,
  pendingChoice: {
    id: 'c', seatId: 'seat-a', verb,
    reason: { kind: 'ability' as const, owner: general('seat-a', abilityId), abilityId },
    options: options.map((id) => ({ id, shows: id.startsWith('seat') ? { kind: 'seat' as const, seatId: id } : { kind: 'label' as const, text: id }, effects: [] })),
  },
});
const selecting = (s: GameState, abilityId: string, of: 'cards' | 'seats', eligibleIds: string[], step = 'x', min = 1, max = 1, seatId = 'seat-a') => ({
  ...s,
  pendingSelection: {
    id: 's', seatId, of, eligibleIds, min, max,
    reason: { kind: 'ability' as const, owner: general('seat-a', abilityId), abilityId },
    then: { kind: 'skill-step' as const, step: { kind: 'SkillStepEffect' as const, owner: general('seat-a', abilityId), step, data: {} } },
    onCancel: [],
  },
});

describe('asks', () => {
  it('Military Farm, Incarnation and Stubborn: always', () => {
    for (const skill of ['military-farm', 'incarnation', 'stubborn']) {
      expect(picked(decide(asking(table({}, { generals: generals('deng-ai') }), skill)))).toBe('use');
    }
  });

  it('Decentralization: with more than 3 hand cards', () => {
    const s = (n: number) => asking(table({ 'seat-a:hand': cards('h', n) }, { generals: generals('liu-shan') }), 'decentralization');
    expect(picked(decide(s(4)))).toBe('use');
    expect(picked(decide(s(3)))).toBe('decline');
  });

  it('Lament: for a victim on its side, not otherwise', () => {
    const s = (victim: string) => asking(table({ 'seat-a:hand': cards('h', 2) }, { generals: generals('cai-wenji'), kingdoms: { ...kingdoms, 'seat-a': 'Qun', 'seat-b': 'Qun' } }), 'lament', victim);
    expect(picked(decide(s('seat-a')))).toBe('use');
    expect(picked(decide(s('seat-c')))).toBe('decline');
  });

  it('Lament: reads the source through a reveal effect when Cai Wenji is hidden', () => {
    // Allies seat-a (the bot, Cai Wenji hidden) and seat-b; the Sha came from seat-b onto seat-a: a club or spade must not land on an ally.
    const s = asking(table({ 'seat-a:hand': cards('h', 2) }, { generals: generals('cai-wenji'), kingdoms: { ...kingdoms, 'seat-b': 'Wei' } }), 'lament', 'seat-a');
    const use = { id: 'use', shows: { kind: 'use' as const }, effects: [{ kind: 'RevealGeneralEffect' as const, seatId: 'seat-a', slot: 'main' as const }, { kind: 'SkillStepEffect' as const, owner: general('seat-a', 'lament'), step: 'pay', data: { victim: 'seat-a', source: 'seat-b' } }] };
    const hidden = { ...s, pendingChoice: { ...s.pendingChoice!, options: [use, s.pendingChoice!.options[1]] } };
    expect(picked(decide(hidden))).toBe('decline');
  });

  it('Clever Change: skips the Draw Phase against two non-allies with 2 or more cards each; never Judgment or Discard', () => {
    const t = (phase: GameState['phase'], hands: number) => ({
      ...asking(table({ 'seat-a:hand': cards('h', 2), 'seat-c:hand': cards('c', hands), 'seat-d:hand': cards('d', hands) }, { generals: generals('zhang-he'), kingdoms }), 'clever-change'),
      phase,
    });
    expect(picked(decide(t('Draw', 2)))).toBe('use');
    expect(picked(decide(t('Draw', 1)))).toBe('decline');
    expect(picked(decide(t('Start', 3)))).toBe('decline');
    expect(picked(decide(t('Discard', 3)))).toBe('decline');
  });
});

describe('choices and selections', () => {
  it('Follow the Master: recovers when it can', () => {
    expect(picked(decide(choiceOf(table({}, { generals: generals('jiang-wei') }), ['recover', 'draw'], 'follow-the-master')))).toBe('recover');
  });

  it('Incarnation: the first skill of its preference list that is offered', () => {
    const s = choiceOf(table({}, { generals: generals('zuo-ci') }), ['da-qiao/displace', 'zhou-yu/brave-gesture', 'zhuge-liang/astrology'], 'incarnation');
    expect(picked(decide(s))).toBe('zhou-yu/brave-gesture');
  });

  it('Decentralization: the extra turn goes to the ally with the most cards, else the non-ally with the fewest', () => {
    const t = (k: typeof kingdoms | Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) =>
      choiceOf(table({ 'seat-b:hand': cards('b', 3), 'seat-c:hand': cards('c', 1), 'seat-d:hand': cards('d', 5) }, { generals: generals('liu-shan'), kingdoms: k }), ['seat-b', 'seat-c', 'seat-d'], 'decentralization');
    expect(picked(decide(t(kingdoms)))).toBe('seat-b');
    expect(picked(decide(t({ 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wu', 'seat-d': 'Qun' })))).toBe('seat-c');
  });

  it('Pleasure: pays with a card it can spare, else gives the Sha up', () => {
    const t = (hand: ReturnType<typeof card>[]) => selecting(table({ 'seat-a:hand': hand }), 'pleasure', 'cards', hand.map((c) => c.instanceId), 'paid');
    expect(picked(decide(t([card('p', 'peach', 'heart')])))).toBe('CancelSelectionAction');
    const spare = decide(t([card('x', 'draw-two', 'club'), card('p', 'peach', 'heart')]));
    expect(picked(spare)).toEqual(['x']);
  });

  it('Clever Change: pays its least useful card; takes from the two fullest non-ally hands', () => {
    const base = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')], 'seat-b:hand': cards('b', 4), 'seat-c:hand': cards('c', 3), 'seat-d:hand': cards('d', 2) }, { generals: generals('zhang-he'), kingdoms: { ...kingdoms, 'seat-b': 'Shu', 'seat-d': 'Qun' } });
    expect(picked(decide(selecting(base, 'clever-change', 'cards', ['p', 'x'], 'paid')))).toEqual(['x']);
    expect(picked(decide(selecting(base, 'clever-change', 'seats', ['seat-b', 'seat-c', 'seat-d'], 'draw-take', 1, 2)))).toEqual(['seat-b', 'seat-c']);
  });

  it('Lament: with nothing eligible to pay it cancels rather than picking nothing', () => {
    const s = selecting(table({}, { generals: generals('cai-wenji') }), 'lament', 'cards', [], 'judge');
    expect(picked(decide(s))).toBe('CancelSelectionAction');
  });

  it('Stubborn: gives back the least useful discarded card', () => {
    const s = choiceOf(table({}, { generals: generals('zhang-zhao-and-zhang-hong') }), ['p', 'x'], 'stubborn');
    const withCards = { ...s, zones: s.zones.map((z) => (z.id === 'discardPile' ? { ...z, cards: [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')] } : z)),
      pendingChoice: { ...s.pendingChoice!, options: [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')].map((c) => ({ id: c.instanceId, shows: { kind: 'card' as const, card: c }, effects: [] })) } };
    expect(picked(decide(withCards))).toBe('x');
  });

  it('Instigate: the non-ally with the fewest cards', () => {
    const s = selecting(table({ 'seat-b:hand': cards('b', 3), 'seat-d:hand': cards('d', 1) }, { generals: generals('jiang-wei'), kingdoms }), 'instigate', 'seats', ['seat-b', 'seat-d'], 'ask');
    expect(picked(decide(s))).toEqual(['seat-d']);
    const ally = selecting(table({}, { generals: generals('jiang-wei'), kingdoms: { ...kingdoms, 'seat-b': 'Wei', 'seat-d': 'Wei' } }), 'instigate', 'seats', ['seat-b', 'seat-d'], 'ask');
    expect(picked(decide(ally))).toBe('CancelSelectionAction');
  });
});

describe('active skills', () => {
  const offered = (s: GameState, skill: string) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skill);

  it('Instigate: against a non-ally holding 1 card or fewer; not when all hold plenty', () => {
    const t = (n: number) => table({ 'seat-b:hand': cards('b', n), 'seat-c:hand': cards('c', n), 'seat-d:hand': cards('d', n) }, { generals: generals('jiang-wei'), kingdoms });
    expect(offered(t(1), 'instigate')).toBe(true);
    expect(decide(t(0)).kind).toBe('UseSkillAction');
    expect(decide(t(3)).kind).not.toBe('UseSkillAction');
  });

  it('Direct Instruction: wanted when an ally has the slot free (the bot would otherwise equip it itself)', () => {
    const t = (kd: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) => table({ 'seat-a:hand': [card('cb', 'crossbow', 'club')] }, { generals: generals('zhang-zhao-and-zhang-hong'), kingdoms: kd });
    const wants = (s: GameState) => wantsMountainActive(s, s.seats[0], 'direct-instruction', registry);
    expect(wants(t(kingdoms))).toBe(true);
    expect(wants(t({ 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wu', 'seat-d': 'Qun' }))).toBe(false);
    const worn = table({ 'seat-a:hand': [card('cb', 'crossbow', 'club')], 'seat-b:equip': [card('w', 'crossbow', 'spade')] }, { generals: generals('zhang-zhao-and-zhang-hong'), kingdoms });
    expect(wants(worn)).toBe(false);
  });
});

describe('the Instigate window', () => {
  it('answers with a Sha when it holds one, at Jiang Wei if he is a non-ally; else passes', () => {
    const open = (hasSha: boolean, ally: boolean) => {
      const t = table({ 'seat-b:hand': hasSha ? [card('s1', 'sha')] : [] }, { kingdoms: { 'seat-a': ally ? 'Wei' : 'Qun', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } });
      return {
        ...t,
        pendingResponse: {
          id: 'w', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
          reason: { kind: 'ability' as const, owner: general('seat-a', 'instigate'), abilityId: 'instigate', targetSeatId: 'seat-a' },
          context: { effect: { kind: 'LoseHpEffect' as const, seatId: 'seat-b', amount: 1 } },
        },
      };
    };
    expect(decide(open(true, false)).kind).toBe('RespondAction');
    expect(decide(open(false, false)).kind).toBe('PassAction');
    expect(decide(open(true, true)).kind).toBe('PassAction');
  });
});

describe('Strategic Pass', () => {
  it('uses a Farm as Steal at a non-ally holding cards', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'shan', 'spade', 3)], 'seat-d:hand': [card('x', 'sha')] }, { generals: generals('deng-ai'), kingdoms });
    const awake = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'awakened:strategic-pass': 1 } } : x)) };
    const action = decide(awake);
    expect(action.kind).toBe('UseConversionAction');
    expect(act(awake, action).pendingSelection).toBeDefined(); // the Farm to use
  });
});
