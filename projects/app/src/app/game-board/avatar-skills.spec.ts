import { Action, ContentRegistry, SeatGenerals } from 'engine';
import { avatarSkills, extraSkillsOf } from './avatar-skills';

const active = { canUse: () => true, start: () => [] };
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['sun-quan', { id: 'sun-quan', kingdom: 'Wu', maxHp: 4, skills: [{ id: 'reconsider', active }, { id: 'rescued', lord: true, active }] }],
    ['liu-bei', { id: 'liu-bei', kingdom: 'Shu', maxHp: 4, skills: [{ id: 'kindness', active }, { id: 'passive' }] }],
  ]),
};
const generals = (mainRevealed: boolean): SeatGenerals => ({
  main: { generalDefinitionId: 'sun-quan', revealed: mainRevealed },
  deputy: { generalDefinitionId: 'liu-bei', revealed: true },
});
const kindness: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'deputy', skillId: 'kindness' } };

describe('extra skills (gained, or borrowed through a chosen Form)', () => {
  const seat = (patch: object) => ({ generals: generals(true), ...patch }) as never;
  it('lists a gained skill and the chosen Form’s skill under the slot that holds them', () => {
    const reg: ContentRegistry = { ...registry, generals: new Map(registry.generals).set('zuo', { id: 'zuo', kingdom: 'Qun', maxHp: 3, skills: [{ id: 'instigate', active }] }) };
    const gained = extraSkillsOf(seat({ gainedSkills: [{ slot: 'main', skillId: 'kindness' }] }), reg);
    expect(gained.map((e) => [e.slot, e.skill.id])).toEqual([['main', 'kindness']]);
    const borrowed = extraSkillsOf(seat({ forms: { slot: 'deputy', held: ['zuo'], chosen: { generalId: 'zuo', skillId: 'instigate' } } }), reg);
    expect(borrowed.map((e) => [e.slot, e.skill.id])).toEqual([['deputy', 'instigate']]);
  });

  it('a borrowed active skill gets its own button, enabled by the engine’s action', () => {
    const instigate: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'deputy', skillId: 'instigate' } };
    const extra = [{ slot: 'deputy' as const, skill: { id: 'instigate', active } }];
    expect(avatarSkills(generals(true), registry, [instigate], extra).map((b) => b.skillId)).toEqual(['reconsider', 'kindness', 'instigate']);
    expect(avatarSkills(generals(true), registry, [instigate], extra).at(-1)).toMatchObject({ action: instigate, label: 'Instigate' });
  });
});

describe('avatarSkills', () => {
  it('one button per active skill, Lord skills left out, enabled exactly when the engine offers it', () => {
    expect(avatarSkills(generals(true), registry, [kindness])).toEqual([
      { slot: 'main', skillId: 'reconsider', label: 'Reconsider', action: null },
      { slot: 'deputy', skillId: 'kindness', label: 'Kindness', action: kindness },
    ]);
  });

  it('a hidden General’s skill reads "Reveal: …"', () => {
    expect(avatarSkills(generals(false), registry, [])[0].label).toBe('Reveal: Reconsider');
  });

  it('none before the Generals are chosen', () => {
    expect(avatarSkills(null, registry, [])).toEqual([]);
  });
});
