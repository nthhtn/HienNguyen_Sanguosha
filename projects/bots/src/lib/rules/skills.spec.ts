import type { GameState } from 'engine';
import { ruleBasedPolicy, ruleBasedV3Policy, ruleBasedV6Policy } from '../rule-based';
import { GENERAL_VALUES, KINGDOM_WARS_TABLE } from '../general-values';
import { act, card, decidePicksKw, decideWith, picked, table, useSkill } from '../testing';

const decide = (s: GameState) => decideWith(ruleBasedPolicy, s);
const ZOU_SHI = 'kingdomWars:zou-shi';
const hidden: [string, string, boolean] = ['filler-xu-huang', 'filler-dong-zhuo', false];

describe('rules/skills: Zou Shi', () => {
  it('femme fatale: used early while hidden', () => {
    const s = table({ 'seat-a:hand': [card('s', 'sha')] }, { generals: { 'seat-a': [ZOU_SHI, 'filler-jia-xu', false] }, kingdoms: { 'seat-a': 'Qun' } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kingdomWars:femme-fatale' } });
  });

  // seat-a wears a Crossbow and holds an Ice Sword (no upgrade); seat-b shows Dong Zhuo (Main) and Xu Huang
  // (Deputy), and Xu Huang has the higher table value.
  const impetus = (o: { hand?: boolean; exposed?: boolean } = {}) =>
    table(
      { 'seat-a:hand': o.hand === false ? [] : [card('iw', 'ice-sword')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] },
      {
        generals: { 'seat-a': [ZOU_SHI, 'filler-jia-xu'], 'seat-b': ['dong-zhuo', 'xu-huang', o.exposed !== false], 'seat-c': hidden, 'seat-d': hidden },
        kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wei' },
      },
    );

  it('impetus: hides the higher-valued General of a fully exposed foe', () => {
    let s = impetus();
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kingdomWars:impetus-for-conflicts' } });
    s = act(s, decide(s));
    expect(picked(decide(s))).toEqual(['iw']);
    s = act(s, decide(s));
    expect(picked(decide(s))).toEqual(['seat-b']);
    s = act(s, decide(s));
    expect(picked(decide(s))).toBe('deputy');
  });

  // Rule R5: seat-b shows Kingdom Wars Cao Cao (Main) and Zhen Ji (Deputy). The Identity table rates Cao Cao
  // higher; the Kingdom Wars table rates Zhen Ji higher.
  const kwImpetus = () =>
    table(
      { 'seat-a:hand': [card('iw', 'ice-sword')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] },
      {
        generals: { 'seat-a': [ZOU_SHI, 'filler-jia-xu'], 'seat-b': ['kingdomWars:cao-cao', 'kingdomWars:zhen-ji', true], 'seat-c': hidden, 'seat-d': hidden },
        kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wei' },
      },
    );
  const impetusChoice = (d: (s: GameState) => ReturnType<typeof decide>) => {
    let s = kwImpetus();
    for (let i = 0; i < 3; i++) s = act(s, d(s));
    return picked(d(s));
  };

  it('impetus fixture: the two tables disagree about Cao Cao and Zhen Ji', () => {
    const kwValue = (id: string) => KINGDOM_WARS_TABLE.values[`kingdomWars:${id}`] ?? 0;
    expect(kwValue('zhen-ji')).toBeGreaterThan(kwValue('cao-cao'));
    expect(GENERAL_VALUES['cao-cao'] ?? 0).toBeGreaterThan(GENERAL_VALUES['zhen-ji'] ?? 0);
  });
  it('impetus: rule-based-picks-kw hides by the Kingdom Wars value', () => {
    expect(impetusChoice(decidePicksKw)).toBe('deputy');
  });
  it('impetus: rule-based-v6 hides by the Identity value', () => {
    expect(impetusChoice((s) => decideWith(ruleBasedV6Policy, s))).toBe('main');
  });

  it('impetus: never discards a worn card', () => {
    expect(decide(impetus({ hand: false })).kind).toBe('EndPhaseAction');
  });

  it('impetus: no fully exposed foe', () => {
    // seat-d (Qun, an ally) is the only seat with both Generals exposed.
    const s = table(
      { 'seat-a:hand': [card('iw', 'ice-sword')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] },
      { generals: { 'seat-a': [ZOU_SHI, 'filler-jia-xu'], 'seat-b': hidden, 'seat-c': hidden }, kingdoms: { 'seat-a': 'Qun' } },
    );
    expect(decide(s).kind).toBe('EndPhaseAction');
  });
});

describe('rules/skills: Benevolence', () => {
  // Kingdom Wars Liu Bei at 3/4 HP with `n` Shan; seat-b is a Shu ally.
  const liuBei = (n: number) =>
    table(
      { 'seat-a:hand': Array.from({ length: n }, (_, i) => card(`k${i}`, 'shan')) },
      { generals: { 'seat-a': ['kingdomWars:liu-bei', 'filler-meng-huo'], 'seat-b': ['filler-jiang-wei', 'filler-liu-shan'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' }, hp: { 'seat-a': 3 } },
    );

  it('benevolence: hurt with 3 hand cards gives 3', () => {
    const s = liuBei(3);
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kingdomWars:benevolence' } });
    const selecting = useSkill(s, 'kingdomWars:benevolence');
    expect(picked(decide(selecting))).toHaveLength(3);
    const giving = act(selecting, decide(selecting));
    expect(picked(decide(giving))).toBe('seat-b');
  });

  it('benevolence: hurt with 2 cards: not used', () => {
    expect(decide(liuBei(2)).kind).toBe('EndPhaseAction');
  });

  it('benevolence: rule-based-v3 still gives 2', () => {
    const selecting = useSkill(liuBei(3), 'kingdomWars:benevolence');
    expect(picked(decideWith(ruleBasedV3Policy, selecting))).toHaveLength(2);
  });
});
