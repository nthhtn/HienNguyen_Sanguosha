import { createRng, getLegalActions } from 'engine';
import { pickRandomAction } from './random';
import { act, card, decide, picked, registry, table } from './testing';

// The Fire Generals' bot rules (stage 9 spec, "Bots").

describe('Fire conversions', () => {
  it('a bot that opened See Through fills its card pick instead of cancelling', () => {
    // seat-b Steals from Fire Zhuge Liang (seat-a), who holds a black card.
    let s = table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('k', 'shan', 'club', 4)] }, { owner: 'seat-b', generals: { 'seat-a': ['fire-zhuge-liang', 'filler-jiang-wei'] } });
    s = act(s, { kind: 'PlayCardAction', seatId: 'seat-b', cardInstanceId: 'st', targets: [{ kind: 'seat', seatId: 'seat-a' }] });
    const open = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseConversionAction')!;
    s = act(s, open);
    expect(picked(decide(s))).toEqual(['k']);
  });
});

describe('same-suit selections (Random Strike)', () => {
  // Yuan Shao opened Random Strike: hearts are his least useful cards only one at a time.
  const opened = () => {
    const s = table(
      { 'seat-a:hand': [card('h1', 'shan', 'heart', 2), card('s1', 'shan', 'spade', 3), card('s2', 'shan', 'spade', 4), card('h2', 'peach', 'heart', 5)] },
      { generals: { 'seat-a': ['yuan-shao', 'filler-dong-zhuo'] } }
    );
    return act(s, getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseConversionAction')!);
  };

  it('the rule-based bot picks 2 cards of one suit', () => {
    const ids = picked(decide(opened())) as string[];
    expect(new Set(ids.map((id) => id[0]))).toEqual(new Set([ids[0][0]]));
    expect(ids).toHaveLength(2);
  });

  it('the random bot picks 2 cards of one suit, whatever the seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { action } = pickRandomAction(opened(), createRng(seed), registry);
      if (action.kind !== 'SelectAction') continue;
      expect(new Set(action.ids.map((id) => id[0])).size).toBe(1);
    }
  });
});

describe('target templates (several targets in one pick)', () => {
  // seat-a's last hand card is a Sha and it wears Sky Scorcher: one template of up to 3.
  const lastSha = (o: Parameters<typeof table>[1] = {}) =>
    table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)] }, o);

  it('the random bot fills a template with distinct listed seats, within min..max, which resolve accepts', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { action } = pickRandomAction(lastSha(), createRng(seed), registry);
      if (action.kind !== 'PlayCardAction') continue;
      expect(action.pickTargets).toBeUndefined();
      expect(action.targets.length).toBeGreaterThanOrEqual(1);
      expect(() => act(lastSha(), action)).not.toThrow();
    }
  });

  it('the rule-based bot fills it with non-allies, weakest first', () => {
    const s = lastSha({ hp: { 'seat-b': 4, 'seat-c': 2, 'seat-d': 3 }, kingdoms: { 'seat-b': 'Wei' } });
    const action = decide(s);
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1', targets: [{ seatId: 'seat-c' }, { seatId: 'seat-d' }] });
    expect(action).not.toHaveProperty('pickTargets');
  });
});
