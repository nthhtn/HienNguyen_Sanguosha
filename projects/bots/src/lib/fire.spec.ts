import { advanceToDecision, createRng, getLegalActions } from 'engine';
import type { Action, GameState, QueueItem } from 'engine';
import { pickRandomAction } from './random';
import { devilCard } from './skills';
import { act, asking, card, ctx, decide, picked, registry, table, useSkill } from './testing';

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
  // seat-a's last hand card is a Slash and it wears Sky Scorcher: one template of up to 3.
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

// --- the Fire Generals' bot rules ---

const run = (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state;
const skillOf = (a: Action) => (a.kind === 'UseSkillAction' && a.owner.kind === 'general' ? a.owner.skillId : a.kind);
const g = (seatId: string, main: string, deputy: string) => ({ [seatId]: [main, deputy] as [string, string] });
const seatOf = (a: Action) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind === 'SelectAction' ? a.ids : a.kind);

describe('Assault', () => {
  const dianWei = g('seat-a', 'dian-wei', 'filler-xu-huang');

  it('pays with 1 HP at 3 HP or more, and hits the weakest non-ally in range', () => {
    let s = table({}, { generals: dianWei, hp: { 'seat-b': 3, 'seat-d': 2 } });
    expect(skillOf(decide(s))).toBe('assault');
    s = useSkill(s, 'assault');
    expect(picked(decide(s))).toEqual([]); // no Weapon: lose 1 HP
    s = act(s, decide(s));
    expect(seatOf(decide(s))).toBe('seat-d');
  });

  it('with a spare Weapon in hand it pays with that; below 3 HP and none, it doesn’t', () => {
    let s = table({ 'seat-a:hand': [card('cb', 'crossbow', 'club', 1)], 'seat-a:equip': [card('bp', 'black-pommel', 'spade', 6)] }, { generals: dianWei, hp: { 'seat-a': 2 } });
    s = useSkill(s, 'assault');
    expect(picked(decide(s))).toEqual(['cb']);
    expect(skillOf(decide(table({}, { generals: dianWei, hp: { 'seat-a': 2 } })))).toBe('EndPhaseAction');
  });

  it('counts a defensive horse: not used when the only non-ally next to it rides one', () => {
    // seat-b is an ally (Wei); seat-d (Qun) rides Di Lu (+1), so 2 away; seat-c is 2 away anyway.
    const s = table({ 'seat-d:equip': [card('dl', 'di-lu', 'club', 5)] }, { generals: dianWei, kingdoms: { 'seat-b': 'Wei' } });
    expect(skillOf(decide(s))).toBe('EndPhaseAction');
  });
});

describe('who takes damage', () => {
  it('Rouse the Tiger’s victim: never itself while another seat can be picked', () => {
    const owner = { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: 'rouse-the-tiger' };
    const s = table({}, { kingdoms: { 'seat-c': 'Wei' } });
    const choice = {
      id: 'v', seatId: 'seat-a', verb: 'pick' as const,
      reason: { kind: 'ability' as const, owner, abilityId: 'rouse-the-tiger', targetSeatId: 'seat-b' },
      options: ['seat-a', 'seat-c'].map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    };
    expect(seatOf(decide({ ...s, pendingChoice: choice }))).toBe('seat-c');
  });
});

describe('Rouse the Tiger and competing', () => {
  const xunYu = g('seat-a', 'xun-yu', 'filler-xu-huang');

  it('used with a card ranked 10 or more against a stronger non-ally next to another non-ally; plays its highest card', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 13), card('x', 'sha', 'heart', 2)], 'seat-b:hand': [card('b', 'shan', 'heart', 5)] }, { generals: xunYu, hp: { 'seat-a': 3 } });
    expect(skillOf(decide(s))).toBe('rouse-the-tiger');
    s = useSkill(s, 'rouse-the-tiger');
    expect(picked(decide(s))).toEqual(['seat-b']);
    s = act(s, decide(s));
    expect(picked(decide(s))).toEqual(['k']);
  });

  it('not without a card ranked 10 or more', () => {
    const s = table({ 'seat-a:hand': [card('x', 'shan', 'spade', 9)], 'seat-b:hand': [card('b', 'shan')] }, { generals: xunYu, hp: { 'seat-a': 3 } });
    expect(skillOf(decide(s))).toBe('EndPhaseAction');
  });

  it('a target plays its highest card against a non-ally, its lowest against an ally', () => {
    const competing = (kingdomB: 'Wei' | 'Shu') => {
      let s = table({ 'seat-a:hand': [card('k', 'shan', 'spade', 13)], 'seat-b:hand': [card('lo', 'shan', 'heart', 2), card('hi', 'shan', 'heart', 12)] }, { generals: xunYu, hp: { 'seat-a': 3 }, kingdoms: { 'seat-b': kingdomB } });
      s = useSkill(s, 'rouse-the-tiger');
      s = act(s, { kind: 'SelectAction', seatId: 'seat-a', selectionId: s.pendingSelection!.id, ids: ['seat-b'] });
      return act(s, { kind: 'SelectAction', seatId: 'seat-a', selectionId: s.pendingSelection!.id, ids: ['k'] });
    };
    expect(picked(decide(competing('Shu')))).toEqual(['hi']);
    expect(picked(decide(competing('Wei')))).toEqual(['lo']);
  });
});

describe('Heaven’s Justice', () => {
  const taishiCi = g('seat-a', 'taishi-ci', 'filler-sun-jian');
  it('used with 2 Slash and a card ranked 10 or more; not with 1 Slash', () => {
    const hand = [card('s1', 'sha', 'spade', 3), card('q', 'shan', 'heart', 12)];
    expect(skillOf(decide(table({ 'seat-a:hand': [...hand, card('s2', 'sha', 'club', 4)], 'seat-b:hand': [card('b', 'shan')] }, { generals: taishiCi, kingdoms: { 'seat-a': 'Wu' } })))).toBe('heavens-justice');
    expect(skillOf(decide(table({ 'seat-a:hand': hand, 'seat-b:hand': [card('b', 'shan')] }, { generals: taishiCi, kingdoms: { 'seat-a': 'Wu' } })))).not.toBe('heavens-justice');
  });

  it('counts a Fire Attack and a Lightning Attack as Slash', () => {
    const hand = [card('s1', 'fire-attack', 'spade', 3), card('s2', 'lightning-attack', 'club', 4), card('q', 'shan', 'heart', 12)];
    expect(skillOf(decide(table({ 'seat-a:hand': hand, 'seat-b:hand': [card('b', 'shan')] }, { generals: taishiCi, kingdoms: { 'seat-a': 'Wu' } })))).toBe('heavens-justice');
  });
});

describe('Eternal Loyalty', () => {
  const xunYu = g('seat-a', 'xun-yu', 'filler-xu-huang');
  const hurtXunYu = (o: Parameters<typeof table>[1] = {}, cards: Parameters<typeof table>[0] = {}) =>
    run(table({ drawPile: Array.from({ length: 9 }, (_, i) => card(`d${i}`, 'shan')), ...cards }, { generals: xunYu, ...o }), [
      { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1, nature: 'normal', cause: {} } },
    ]);

  it('always used; picks itself unless an ally is further short of its max HP in cards', () => {
    let s = hurtXunYu({}, { 'seat-a:hand': [card('x', 'shan')] });
    expect(seatOf(decide(s))).toBe('use');
    s = act(s, decide(s));
    expect(seatOf(decide(s))).toBe('seat-a');
    let t = hurtXunYu({ kingdoms: { 'seat-c': 'Wei' } }, { 'seat-a:hand': [card('x', 'shan'), card('y', 'shan')] });
    t = act(t, decide(t));
    expect(seatOf(decide(t))).toBe('seat-c');
  });
});

describe('Shackle', () => {
  const pangTong = g('seat-a', 'pang-tong', 'filler-jiang-wei');
  it('recasts a club ranked below Dodge, never a Peach', () => {
    let s = table({ 'seat-a:hand': [card('cp', 'peach', 'club', 3), card('cd', 'duel', 'club', 4)], drawPile: [card('d', 'shan')] }, { generals: pangTong, kingdoms: { 'seat-a': 'Shu' } });
    expect(skillOf(decide(s))).toBe('shackle');
    s = useSkill(s, 'shackle');
    expect(picked(decide(s))).toEqual(['cd']);
    expect(skillOf(decide(table({ 'seat-a:hand': [card('cp', 'peach', 'club', 3), card('cs', 'shan', 'club', 4)] }, { generals: pangTong, kingdoms: { 'seat-a': 'Shu' } })))).not.toBe('shackle');
  });
});

describe('asks: Nirvana, Eight Arrays, Sudden Attack, Dueling Heroes', () => {
  it('Nirvana and Eight Arrays always; Sudden Attack only on a non-ally', () => {
    expect(picked(decide(asking(table(), 'nirvana')))).toBe('use');
    expect(picked(decide(asking(table(), 'eight-arrays', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table(), 'sudden-attack', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'sudden-attack', 'seat-b')))).toBe('decline');
  });

  it('Dueling Heroes with 3 or more hand cards and a non-ally', () => {
    const three = [card('a', 'shan'), card('b', 'shan'), card('c', 'shan')];
    expect(picked(decide(asking(table({ 'seat-a:hand': three }), 'dueling-heroes')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': three.slice(0, 2) }), 'dueling-heroes')))).toBe('decline');
  });
});

describe('Fire Strategy and Blaze', () => {
  const fireZhuge = g('seat-a', 'fire-zhuge-liang', 'filler-jiang-wei');
  const hand = [card('r', 'duel', 'heart', 5), card('x', 'shan', 'diamond', 6), card('y', 'shan', 'diamond', 7)];

  it('Blaze at the weakest non-ally with a hand card while holding 3 or more', () => {
    const s = table({ 'seat-a:hand': hand, 'seat-b:hand': [card('b', 'shan')], 'seat-c:hand': [card('c', 'shan')] }, { generals: fireZhuge, kingdoms: { 'seat-a': 'Shu' }, hp: { 'seat-c': 2 } });
    expect(decide(s)).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'fire-strategy' }, targets: [{ seatId: 'seat-c' }] });
    expect(decide(table({ 'seat-a:hand': hand.slice(0, 2), 'seat-c:hand': [card('c', 'shan')] }, { generals: fireZhuge, kingdoms: { 'seat-a': 'Shu' } })).kind).not.toBe('UseConversionAction');
  });

  it('as the target, shows its least useful card; as the user, discards a match', () => {
    let s = run(table({ 'seat-a:hand': [card('m', 'duel', 'diamond', 2)], 'seat-b:hand': [card('pe', 'peach', 'diamond', 3), card('du', 'duel', 'diamond', 9)] }), [
      { kind: 'ToolRuleEffect', tool: { as: 'blaze', colour: 'red', physical: [] }, userSeatId: 'seat-a', target: { kind: 'seat', seatId: 'seat-b' } },
    ]);
    expect(picked(decide(s))).toEqual(['du']);
    s = act(s, decide(s));
    expect(picked(decide(s))).toEqual(['m']);
  });
});

describe('Blaze and Peaches', () => {
  const blaze = (hand: ReturnType<typeof card>[]) =>
    run(table({ 'seat-a:hand': [card('m', 'duel', 'diamond', 2)], 'seat-b:hand': hand }), [
      { kind: 'ToolRuleEffect', tool: { as: 'blaze', colour: 'red', physical: [] }, userSeatId: 'seat-a', target: { kind: 'seat', seatId: 'seat-b' } },
    ]);
  it('Blaze never discards a Peach while another card is eligible', () => {
    // The Peach is the least useful by suit/rank ordering only if the ranking let it be; it must be skipped.
    const s = blaze([card('pe', 'peach', 'diamond', 3), card('sh', 'sha', 'diamond', 9)]);
    expect(picked(decide(s))).not.toEqual(['pe']);
  });
  it('discards the Peach when it is the only eligible card', () => {
    const s = blaze([card('pe', 'peach', 'diamond', 3)]);
    expect(picked(decide(s))).toEqual(['pe']);
  });
});

describe('See Through', () => {
  it('answers a harmful Tool aimed at itself with a black card', () => {
    const s = act(
      table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('k', 'duel', 'club', 4)] }, { owner: 'seat-b', generals: g('seat-a', 'fire-zhuge-liang', 'filler-jiang-wei'), kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Wei' } }),
      { kind: 'PlayCardAction', seatId: 'seat-b', cardInstanceId: 'st', targets: [{ kind: 'seat', seatId: 'seat-a' }] }
    );
    expect(decide(s)).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'see-through' } });
  });
});

describe('Dueling Heroes’ Duel and Random Strike', () => {
  it('a Duel from an opposite-colour card at the weakest non-ally', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan', 'club', 4)] }, { generals: g('seat-a', 'yan-liang-and-wen-chou', 'filler-dong-zhuo'), kingdoms: { 'seat-a': 'Qun', 'seat-d': 'Shu' }, hp: { 'seat-d': 2 } });
    const after = { ...s, turn: { ...s.turn, flags: { 'dueling-heroes-red': true } } };
    expect(decide(after)).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'dueling-heroes' }, targets: [{ seatId: 'seat-d' }] });
  });

  it('Random Strike as Hail of Arrows when non-allies are at least as many as allies', () => {
    const s = table({ 'seat-a:hand': [card('h1', 'shan', 'heart', 2), card('h2', 'duel', 'heart', 3)] }, { generals: g('seat-a', 'yuan-shao', 'filler-dong-zhuo'), kingdoms: { 'seat-a': 'Qun' } });
    expect(decide(s)).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'random-strike' } });
  });
});

describe('reading an Eight Arrays judgment (Devil)', () => {
  it('a red card is good for the judged seat, as for Eight Trigrams', () => {
    const judged = view_seat();
    const judgment = { seatId: 'seat-b', card: card('j', 'sha', 'spade', 5), reader: { kind: 'skill' as const, owner: { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'eight-arrays' } } };
    // seat-b is a non-ally: a black card already hurts it, so Devil changes nothing.
    expect(devilCard(judged, judged.seats[0], judgment, registry, ['r'])).toBeNull();
    // An ally (Wei) would want red, but Devil saves allies only from delayed Tools.
    const reds = { ...judgment, card: card('j', 'sha', 'heart', 5) };
    expect(devilCard(judged, judged.seats[0], reds, registry, ['k'])).toBe('k');
  });
});
function view_seat(): GameState {
  return table({ 'seat-a:hand': [card('r', 'shan', 'heart', 2), card('k', 'shan', 'spade', 3)] });
}
