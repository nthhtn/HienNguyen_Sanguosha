import { Action, ContentRegistry, SeatGenerals } from 'engine';
import { avatarSkills } from './avatar-skills';

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
