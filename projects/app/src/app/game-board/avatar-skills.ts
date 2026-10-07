import { Action, ContentRegistry, SeatGenerals } from 'engine';
import { abilityName } from 'content';

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

export interface AvatarSkill {
  slot: 'main' | 'deputy';
  skillId: string;
  // "Kindness", or "Reveal: Kindness" for a hidden General's.
  label: string;
  // The engine's action while it offers the skill; null = the button is disabled.
  action: UseSkill | null;
}

// One button per active skill of the viewer's own Generals, Lord skills left
// out (they are never in play). Each is enabled exactly when the engine lists
// its UseSkillAction: the UI never decides whether a skill may be used.
export function avatarSkills(generals: SeatGenerals | null, registry: ContentRegistry, legal: readonly Action[]): AvatarSkill[] {
  if (!generals) return [];
  return (['main', 'deputy'] as const).flatMap((slot) => {
    const general = generals[slot];
    const skills = registry.generals.get(general.generalDefinitionId)?.skills ?? [];
    return skills
      .filter((skill) => skill.active && !skill.lord)
      .map((skill): AvatarSkill => {
        const action =
          legal.find((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.slot === slot && a.owner.skillId === skill.id) ?? null;
        const name = abilityName(skill.id);
        return { slot, skillId: skill.id, label: general.revealed ? name : `Reveal: ${name}`, action };
      });
  });
}
