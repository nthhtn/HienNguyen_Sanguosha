import type { SkillDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import type { KingdomWarsGeneralRecord, KingdomWarsGeneralSkillRecord } from './kingdomWarsGenerals';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './skillId';
import { KINGDOM_WARS_VARIANTS } from './kingdomWarsVariants';

// A difference note that says the Kingdom Wars General is the same as Dynasty Wars'.
export const isNilNote = (note: string | null): boolean =>
  note !== null && note.trim().toLowerCase().replace(/\.$/, '') === 'nil';

// General id to the Kingdom Wars skills (by Chinese name) cleared as wording-only differences.
export const CLEARED_WORDING: Readonly<Record<string, readonly string[]>> = {
  // Genius is unchanged from Dynasty Wars'.
  'huang-yueying': ['奇才'],
  // Dirge is unchanged from Dynasty Wars' Lament.
  'cai-wenji': ['悲歌'],
  // Slice 4 audit (docs/superpowers/specs/2026-10-23-kingdom-wars-generals-slice-4-rules.md): the Kingdom Wars
  // text is Dynasty Wars' rule reworded, checked against the Dynasty Wars skill.
  'zhuge-liang': ['观星'],
  'guan-yu': ['武圣'],
  // "In your action phase" is Dynasty Wars' "in your turn" (the only gap is Godspeed's Sha, read as wording).
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

// General id, then Kingdom Wars Chinese name, to Dynasty Wars' Chinese name where the two differ.
export const DYNASTY_WARS_SKILL_ZH: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // Sudden Strike is Dynasty Wars' Raid under another Chinese name.
  'zhang-liao': { '突击': '突袭' },
};

// The Dynasty Wars SkillDefinition this Kingdom Wars skill runs as, or undefined when it is not ready.
// Matches by Chinese name only; Lord skills are never matched.
export function dynastyWarsSkillFor(record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): SkillDefinition | undefined {
  if (!skill.nameZh) return undefined;
  const cleared = isNilNote(record.differenceFromNormal) || (CLEARED_WORDING[record.id] ?? []).includes(skill.nameZh);
  if (!cleared) return undefined;
  const dynastyWarsZh = DYNASTY_WARS_SKILL_ZH[record.id]?.[skill.nameZh] ?? skill.nameZh;
  const base = generalsData[record.id]?.skills.find((s) => !s.lord && s.nameZh === dynastyWarsZh);
  if (!base) return undefined;
  const id = skillIdOf(base.name);
  return GENERAL_SKILLS.get(record.id)?.find((d) => d.id === id);
}

// A registered variant for this Kingdom Wars skill, else undefined.
const kingdomWarsVariantSkillFor = (record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): SkillDefinition | undefined =>
  skill.nameZh ? KINGDOM_WARS_VARIANTS[record.id]?.[skill.nameZh] : undefined;

// Whether this Kingdom Wars skill has a variant of its own (its rules differ from Dynasty Wars').
export const hasKingdomWarsVariant = (record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): boolean =>
  kingdomWarsVariantSkillFor(record, skill) !== undefined;

// The SkillDefinition the game plays for this Kingdom Wars skill: its variant, else Dynasty Wars' skill when the rules are the same.
export const kingdomWarsSkillFor = (record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): SkillDefinition | undefined =>
  kingdomWarsVariantSkillFor(record, skill) ?? dynastyWarsSkillFor(record, skill);

export const readyKingdomWarsSkills = (record: KingdomWarsGeneralRecord): SkillDefinition[] =>
  record.skills.flatMap((s) => kingdomWarsSkillFor(record, s) ?? []);
