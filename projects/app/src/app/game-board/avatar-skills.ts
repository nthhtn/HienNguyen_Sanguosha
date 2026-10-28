import { Action, ContentRegistry, Seat, SeatGenerals, SkillDefinition, findSkill } from 'engine';
import { abilityDisplayName } from '../labels';
import { englishTranslator, Translator } from '../i18n/translator';

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

export interface AvatarSkill {
  slot: 'main' | 'deputy';
  skillId: string;
  // "Kindness", or "Reveal: Kindness" for a hidden General's.
  label: string;
  // The engine's action while it offers the skill; null = the button is disabled.
  action: UseSkill | null;
}

export interface ExtraSkill { slot: 'main' | 'deputy'; skill: SkillDefinition }

// The skills a seat holds besides its Generals' printed ones: those gained for
// good, and the one it chose from its Forms (Incarnation). The engine decides
// which are in play; the buttons only ever enable on its actions.
export function extraSkillsOf(seat: Pick<Seat, 'gainedSkills' | 'forms'>, registry: ContentRegistry): ExtraSkill[] {
  const gained = (seat.gainedSkills ?? []).flatMap(({ slot, skillId }) => {
    const skill = findSkill(registry, skillId);
    return skill ? [{ slot, skill }] : [];
  });
  const chosen = seat.forms?.chosen;
  const borrowed = chosen ? registry.generals.get(chosen.generalId)?.skills.find((s) => s.id === chosen.skillId) : undefined;
  return [...gained, ...(chosen && borrowed ? [{ slot: seat.forms!.slot, skill: borrowed }] : [])];
}

// One button per active skill of the viewer's own Generals, Lord skills left
// out (they are never in play). Each is enabled exactly when the engine lists
// its UseSkillAction: the UI never decides whether a skill may be used.
export function avatarSkills(generals: SeatGenerals | null, registry: ContentRegistry, legal: readonly Action[], extra: readonly ExtraSkill[] = [], tr: Translator = englishTranslator): AvatarSkill[] {
  if (!generals) return [];
  return (['main', 'deputy'] as const).flatMap((slot) => {
    const general = generals[slot];
    const skills = [...(registry.generals.get(general.generalDefinitionId)?.skills ?? []), ...extra.filter((e) => e.slot === slot).map((e) => e.skill)];
    return skills
      .filter((skill) => skill.active && !skill.lord)
      .map((skill): AvatarSkill => {
        const action =
          legal.find((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.slot === slot && a.owner.skillId === skill.id) ?? null;
        const name = abilityDisplayName(skill.id, tr);
        return { slot, skillId: skill.id, label: general.revealed ? name : tr('avatar.revealSkill', { name }), action };
      });
  });
}
