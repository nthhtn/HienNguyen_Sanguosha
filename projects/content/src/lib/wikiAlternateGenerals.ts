import { alternateGeneralRecords, type AlternateGeneralRecord, type AlternateGeneralSkillRecord } from './alternateGenerals';
import { alternateSkillFor } from './alternateSkills';
import { ALTERNATE_VARIANTS } from './alternateVariants';
import { splitIntoTabs, type WikiTab } from './wiki';

// Whether the game can play an Alternate skill: as its own variant ("worksAsAlternate"), as Default's
// version when the rules are the same ("worksAsDefault"), or not yet ("missing").
export type AlternateSkillStatus = 'worksAsDefault' | 'worksAsAlternate' | 'missing';

export interface WikiAlternateSkill {
  name: string;
  nameZh: string | null;
  text: string;
  status: AlternateSkillStatus;
}

export interface WikiAlternateGeneral {
  id: string;
  name: string;
  nameZh: string | null;
  title: string | null;
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun';
  maxHp: number;
  gender: 'male' | 'female';
  skills: WikiAlternateSkill[];
  partners: string[];
  differenceNote: string | null;
  // Every skill works as Default (and there is at least one).
  skillsRunAsDefault: boolean;
}

export function alternateSkillStatus(record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): AlternateSkillStatus {
  if (!alternateSkillFor(record, skill)) return 'missing';
  return skill.nameZh && ALTERNATE_VARIANTS[record.id]?.[skill.nameZh] ? 'worksAsAlternate' : 'worksAsDefault';
}

const KINGDOMS: Record<AlternateGeneralRecord['force'], WikiAlternateGeneral['kingdom']> = { wei: 'Wei', shu: 'Shu', wu: 'Wu', qun: 'Qun' };
const KINGDOM_ORDER: readonly WikiAlternateGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];

export function wikiAlternateGenerals(): WikiAlternateGeneral[] {
  return alternateGeneralRecords()
    .map((rec): WikiAlternateGeneral => {
      const skills = rec.skills.map((s) => ({ name: s.name, nameZh: s.nameZh ?? null, text: s.text, status: alternateSkillStatus(rec, s) }));
      return {
        id: rec.id,
        name: rec.name,
        nameZh: rec.nameZh ?? null,
        title: rec.title ?? null,
        kingdom: KINGDOMS[rec.force],
        maxHp: rec.maxHp,
        gender: rec.gender,
        skills,
        partners: rec.synergisticPartners,
        differenceNote: rec.differenceFromNormal,
        skillsRunAsDefault: skills.length > 0 && skills.every((s) => s.status === 'worksAsDefault'),
      };
    })
    .sort((a, b) => KINGDOM_ORDER.indexOf(a.kingdom) - KINGDOM_ORDER.indexOf(b.kingdom) || a.name.localeCompare(b.name));
}

export function wikiAlternateGeneralTabs(): WikiTab<WikiAlternateGeneral>[] {
  return splitIntoTabs(
    wikiAlternateGenerals(),
    KINGDOM_ORDER.map((k) => ({ key: k.toLowerCase(), label: k, holds: (g: WikiAlternateGeneral) => g.kingdom === k })),
  );
}
