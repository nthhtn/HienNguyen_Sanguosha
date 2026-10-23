import type { SkillDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import type { AlternateGeneralRecord, AlternateGeneralSkillRecord } from './alternateGenerals';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './skillId';
import { ALTERNATE_VARIANTS } from './alternateVariants';

// A difference note that says the Alternate General is the same as Default's.
export const isNilNote = (note: string | null): boolean =>
  note !== null && note.trim().toLowerCase().replace(/\.$/, '') === 'nil';

// General id to the Alternate skills (by Chinese name) cleared as wording-only differences.
export const CLEARED_WORDING: Readonly<Record<string, readonly string[]>> = {
  // Genius is unchanged from Default's.
  'huang-yueying': ['奇才'],
  // Dirge is unchanged from Default's Lament.
  'cai-wenji': ['悲歌'],
  // Slice 4 audit (docs/superpowers/specs/2026-10-23-alternate-generals-slice-4-rules.md): the Alternate
  // text is Default's rule reworded, checked against the Default skill.
  'zhuge-liang': ['观星'],
  'guan-yu': ['武圣'],
  // "In your action phase" is Default's "in your turn" (the only gap is Godspeed's Sha, read as wording).
  'huang-zhong': ['烈弓'],
  'liu-shan': ['享乐', '放权'],
  'ma-chao': ['马术', '铁骑'],
  'pang-tong': ['连环'],
  'zhu-rong': ['巨象'],
  'cao-cao': ['奸雄'],
  'cao-pi': ['行殇', '放逐'],
  'cao-ren': ['据守'],
  'guo-jia': ['天妒'],
  'sima-yi': ['反馈', '鬼才'],
  'xun-yu': ['驱虎'],
  'zhang-he': ['巧变'],
  'zhang-liao': ['突击'],
  'zhen-ji': ['倾国'],
  'sun-shangxiang': ['结姻'],
  'xiao-qiao': ['天香', '红颜'],
  'zhou-yu': ['英姿', '反间'],
  'yuan-shao': ['乱击'],
  'zhang-jiao': ['鬼道'],
  'lu-bu': ['无双'],
  'jia-xu': ['完杀'],
};

// General id, then Alternate Chinese name, to Default's Chinese name where the two differ.
export const DEFAULT_SKILL_ZH: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // Sudden Strike is Default's Raid under another Chinese name.
  'zhang-liao': { '突击': '突袭' },
};

// The Default SkillDefinition this Alternate skill runs as, or undefined when it is not ready.
// Matches by Chinese name only; Lord skills are never matched.
export function defaultSkillFor(record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): SkillDefinition | undefined {
  if (!skill.nameZh) return undefined;
  const cleared = isNilNote(record.differenceFromNormal) || (CLEARED_WORDING[record.id] ?? []).includes(skill.nameZh);
  if (!cleared) return undefined;
  const defaultZh = DEFAULT_SKILL_ZH[record.id]?.[skill.nameZh] ?? skill.nameZh;
  const base = generalsData[record.id]?.skills.find((s) => !s.lord && s.nameZh === defaultZh);
  if (!base) return undefined;
  const id = skillIdOf(base.name);
  return GENERAL_SKILLS.get(record.id)?.find((d) => d.id === id);
}

// A registered variant for this Alternate skill, else undefined.
const alternateVariantSkillFor = (record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): SkillDefinition | undefined =>
  skill.nameZh ? ALTERNATE_VARIANTS[record.id]?.[skill.nameZh] : undefined;

// Whether this Alternate skill has a variant of its own (its rules differ from Default's).
export const hasAlternateVariant = (record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): boolean =>
  alternateVariantSkillFor(record, skill) !== undefined;

// The SkillDefinition the game plays for this Alternate skill: its variant, else Default's skill when the rules are the same.
export const alternateSkillFor = (record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): SkillDefinition | undefined =>
  alternateVariantSkillFor(record, skill) ?? defaultSkillFor(record, skill);

export const readyAlternateSkills = (record: AlternateGeneralRecord): SkillDefinition[] =>
  record.skills.flatMap((s) => alternateSkillFor(record, s) ?? []);
