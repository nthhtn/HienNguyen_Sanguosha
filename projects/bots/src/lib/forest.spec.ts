import { getLegalActions } from 'engine';
import type { GameState } from 'engine';
import { asking, card, decide, picked, registry, table } from './testing';

// The Forest Generals' bot rules (stage 10 spec, "Bots").

const generals = (a: string, extra: Record<string, [string, string]> = {}) => ({ 'seat-a': [a, 'filler-jiang-wei'] as [string, string], ...extra });
const choiceOf = (s: GameState, ids: string[], verb: 'pick' | 'give' = 'pick', abilityId = 'x', ownerSeatId = 'seat-a', targetSeatId?: string) => ({
  ...s,
  pendingChoice: {
    id: 'c', seatId: 'seat-a', verb,
    reason: { kind: 'ability' as const, owner: { kind: 'general' as const, seatId: ownerSeatId, slot: 'main' as const, skillId: abilityId }, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: ids.map((id) => ({ id, shows: id.startsWith('seat') ? { kind: 'seat' as const, seatId: id } : { kind: 'label' as const, text: id }, effects: [] })),
  },
});

describe('asks', () => {
  it('Unnatural Death and Brave Spirit: always; Exile: always', () => {
    for (const skill of ['unnatural-death', 'brave-spirit', 'exile']) {
      expect(picked(decide(asking(table({}, { generals: generals('cao-pi') }), skill)))).toBe('use');
    }
  });

  it('Resurgence: only when missing 2 or more HP', () => {
    const s = (hp: number) => asking(table({}, { generals: generals('meng-huo'), hp: { 'seat-a': hp } }), 'resurgence');
    expect(picked(decide(s(2)))).toBe('use');
    expect(picked(decide(s(3)))).toBe('decline');
  });

  it('Intense Edge: with a card ranked 9 or higher', () => {
    const s = (rank: number) => asking(table({ 'seat-a:hand': [card('c', 'sha', 'heart', rank)] }, { generals: generals('zhu-rong') }), 'intense-edge', 'seat-b');
    expect(picked(decide(s(9)))).toBe('use');
    expect(picked(decide(s(8)))).toBe('decline');
  });

  it('Charity: with 3 or fewer cards', () => {
    const hand = (n: number) => Array.from({ length: n }, (_, i) => card(`h${i}`, 'shan', 'heart', i + 1));
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(3) }, { generals: generals('lu-su') }), 'charity')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(4) }, { generals: generals('lu-su') }), 'charity')))).toBe('decline');
  });
});

describe('choices', () => {
  it('Exile: the non-ally with the fewest hand cards', () => {
    const s = choiceOf(table({ 'seat-b:hand': [card('x', 'sha'), card('y', 'sha')], 'seat-c:hand': [card('z', 'sha')], 'seat-d:hand': [card('w', 'sha'), card('v', 'sha')] }, { generals: generals('cao-pi') }), ['seat-b', 'seat-c', 'seat-d'], 'pick', 'exile');
    expect(picked(decide(s))).toBe('seat-c');
  });

  it('Collapse: loses HP at 3 or more, else reduces max HP', () => {
    const s = (hp: number) => choiceOf(table({}, { generals: generals('dong-zhuo'), hp: { 'seat-a': hp } }), ['lose-hp', 'reduce-max-hp'], 'pick', 'collapse');
    expect(picked(decide(s(3)))).toBe('lose-hp');
    expect(picked(decide(s(2)))).toBe('reduce-max-hp');
  });

  it('Upheaval: the weakest non-ally in range, never an ally, else pass', () => {
    const t = (o: Parameters<typeof table>[1] = {}) => choiceOf(table({}, { generals: generals('filler-xu-huang'), ...o }), ['seat-b', 'seat-d', 'pass'], 'pick', 'upheaval');
    expect(picked(decide(t({ hp: { 'seat-b': 3, 'seat-d': 2 } })))).toBe('seat-d');
    expect(picked(decide(t({ kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-d': 'Wei' } })))).toBe('pass');
  });

  it('Charity: gives to an ally among the tied seats', () => {
    const s = choiceOf(table({}, { generals: generals('lu-su'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Shu' } }), ['seat-b', 'seat-c', 'seat-d'], 'give', 'charity');
    expect(picked(decide(s))).toBe('seat-c');
  });

  it("Brave Spirit's seat: an ally short of cards, else himself", () => {
    const seats = choiceOf(table({ 'seat-c:hand': [] }, { generals: generals('sun-jian'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' }, hp: { 'seat-a': 2 } }), ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 'pick', 'brave-spirit');
    expect(picked(decide(seats))).toBe('seat-c');
  });

  // The mode choice is the owner's (seat-a, Sun Jian); X is his missing HP (4 max); seat-c is his ally.
  const mode = (hp: number, target: 'seat-a' | 'seat-c', hand: ReturnType<typeof card>[] = []) =>
    choiceOf(
      table({ [`${target}:hand`]: hand }, { generals: generals('sun-jian'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' }, hp: { 'seat-a': hp } }),
      ['draw-x', 'draw-1'], 'pick', 'brave-spirit', 'seat-a', target
    );
  const spare = (n: number) => Array.from({ length: n }, (_, i) => card(`p${i}`, 'sha', 'club', i + 1));

  it('Brave Spirit: an ally is always given X cards and discards 1, even with a large hand and X of 3', () => {
    expect(picked(decide(mode(1, 'seat-c', spare(5))))).toBe('draw-x');
  });

  it('Brave Spirit: an ally is given X cards and discards 1 for X of 2 or less', () => {
    expect(picked(decide(mode(2, 'seat-c', spare(5))))).toBe('draw-x');
  });

  it('Brave Spirit: himself with spare cards to discard draws 1 and discards X', () => {
    expect(picked(decide(mode(1, 'seat-a', spare(4))))).toBe('draw-1'); // X = 3
  });

  it('Brave Spirit: himself with too few spare cards draws X and discards 1', () => {
    expect(picked(decide(mode(1, 'seat-a', spare(2))))).toBe('draw-x'); // X = 3
  });
});

describe('active skills', () => {
  it('Alliance: swaps a non-ally’s larger hand into a short ally at a cost it can pay', () => {
    const cards = (p: string, n: number) => Array.from({ length: n }, (_, i) => card(`${p}${i}`, 'shan', 'heart', i + 1));
    const t = (aHand: number) =>
      table({ 'seat-a:hand': cards('a', aHand), 'seat-b:hand': cards('b', 4), 'seat-c:hand': cards('c', 2) }, { generals: generals('lu-su'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' } });
    const offered = (s: GameState) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction');
    expect(offered(t(3))).toBe(true);
    const s = decide(t(3));
    expect(s.kind).toBe('UseSkillAction');
  });

  it('Upheaval: only with 3 or more non-allies', () => {
    const t = (kingdoms: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) => table({}, { generals: generals('jia-xu'), kingdoms });
    expect(decide(t({ 'seat-a': 'Qun', 'seat-d': 'Wu' })).kind).toBe('UseSkillAction');
    expect(decide(t({ 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Wei' })).kind).not.toBe('UseSkillAction');
  });
});

describe('the Upheaval window', () => {
  it('answers with a Slash when it holds one, at a non-ally; else passes', () => {
    // Built directly: seat-b is asked to Slash seat-c.
    const open = (hasSha: boolean, ally: boolean, abilityId = 'upheaval') => {
      const t = table({ 'seat-b:hand': hasSha ? [card('s1', 'sha')] : [] }, { kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wei', 'seat-c': ally ? 'Wei' : 'Shu', 'seat-d': 'Wu' } });
      return {
        ...t,
        pendingResponse: {
          id: 'w', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
          reason: { kind: 'ability' as const, owner: { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: abilityId }, abilityId, targetSeatId: 'seat-c' },
          context: { effect: { kind: 'LoseHpEffect' as const, seatId: 'seat-b', amount: 1 } },
        },
      };
    };
    expect(decide(open(true, false)).kind).toBe('RespondAction');
    expect(decide(open(false, false)).kind).toBe('PassAction');
    expect(decide(open(true, true)).kind).toBe('PassAction'); // never a Slash at an ally
    // Alternate Descend into Chaos plays the same.
    expect(decide(open(true, false, 'alternate:descend-into-chaos')).kind).toBe('RespondAction');
    expect(decide(open(true, true, 'alternate:descend-into-chaos')).kind).toBe('PassAction');
  });
});

describe('Alliance’s second pick', () => {
  const cards = (p: string, n: number) => Array.from({ length: n }, (_, i) => card(`${p}${i}`, 'shan', 'heart', i + 1));
  const second = (hands: Record<string, number>, ids: string[]) => {
    const s = table(Object.fromEntries(Object.entries(hands).map(([id, n]) => [`${id}:hand`, cards(id, n)])), { generals: generals('lu-su'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wu', 'seat-c': 'Wei', 'seat-d': 'Wei' } });
    const c = choiceOf(s, [...ids, 'cancel'], 'pick', 'alliance');
    return { ...c, pendingChoice: { ...c.pendingChoice!, reason: { ...c.pendingChoice!.reason, targetSeatId: 'seat-b' } } } as GameState;
  };
  it('Alliance: the second pick keeps the cost at 2 or less', () => {
    // first = seat-b (1 card); seat-c has 5 (cost 4), seat-d has 3 (cost 2).
    expect(picked(decide(second({ 'seat-b': 1, 'seat-c': 5, 'seat-d': 3 }, ['seat-c', 'seat-d'])))).toBe('seat-d');
  });
  it('Alliance: with no partner at cost 2 or less the bot cancels', () => {
    expect(picked(decide(second({ 'seat-b': 1, 'seat-c': 5, 'seat-d': 4 }, ['seat-c', 'seat-d'])))).toBe('cancel');
  });
});
