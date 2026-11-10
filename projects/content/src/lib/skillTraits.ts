import type { SkillDefinition } from 'engine';

// What a badge next to a skill name says: Locked (compulsory), Limited (once per game) or Once Per Turn.
export type SkillTrait = 'locked' | 'limited' | 'oncePerTurn';

// The traits the game's code gives a skill, in the order the Wiki shows the badges. None when the game has no code for it.
export function skillTraits(skill: SkillDefinition | undefined): SkillTrait[] {
  if (!skill) return [];
  return [skill.compulsory ? 'locked' : null, skill.limited ? 'limited' : null, skill.active?.usesPerTurn === 1 ? 'oncePerTurn' : null].filter((t): t is SkillTrait => t !== null);
}
