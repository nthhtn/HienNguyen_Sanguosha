import type { SkillDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import type { AlternateGeneralRecord, AlternateGeneralSkillRecord } from './alternateGenerals';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './display';

// A difference note that says the Alternate General is the same as Default's.
export const isNilNote = (note: string | null): boolean =>
  note !== null && note.trim().toLowerCase().replace(/\.$/, '') === 'nil';

// General id to the Alternate skills (by Chinese name) cleared as wording-only differences.
export const CLEARED_WORDING: Readonly<Record<string, readonly string[]>> = {};

// The Default SkillDefinition this Alternate skill runs as, or undefined when it is not ready.
// Matches by Chinese name only; Lord skills are never matched.
export function defaultSkillFor(record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): SkillDefinition | undefined {
  if (!skill.nameZh) return undefined;
  const cleared = isNilNote(record.differenceFromNormal) || (CLEARED_WORDING[record.id] ?? []).includes(skill.nameZh);
  if (!cleared) return undefined;
  const base = generalsData[record.id]?.skills.find((s) => !s.lord && s.nameZh === skill.nameZh);
  if (!base) return undefined;
  const id = skillIdOf(base.name);
  return GENERAL_SKILLS.get(record.id)?.find((d) => d.id === id);
}

export const readyAlternateSkills = (record: AlternateGeneralRecord): SkillDefinition[] =>
  record.skills.flatMap((s) => defaultSkillFor(record, s) ?? []);
