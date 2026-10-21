import { generalsData, type GeneralData } from '../../data/generals';
import { alternateGeneralRecords, type AlternateGeneralRecord } from './alternateGenerals';
import { CODED_SKILL_IDS, skillIdFromName, splitIntoTabs, type WikiTab } from './wiki';

// Whether the game can play an Alternate skill. It plays Default's version, not the Alternate
// wording, so the state is not "working": it says the game runs the Default counterpart.
export type AlternateSkillStatus = 'worksAsDefault' | 'missing';

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

// An Alternate skill works as Default when the General's Default counterpart has a skill that is not
// a Lord skill, matches it (by Chinese name when both have one, else by name), and has code.
export function alternateSkillStatus(
  skill: { name: string; nameZh: string | null },
  counterpart: GeneralData | undefined,
  coded: ReadonlySet<string> = CODED_SKILL_IDS,
): AlternateSkillStatus {
  const match = counterpart?.skills.find(
    (d) => !d.lord && ((!!skill.nameZh && !!d.nameZh && skill.nameZh === d.nameZh) || skillIdFromName(skill.name) === skillIdFromName(d.name)),
  );
  return match && coded.has(skillIdFromName(match.name)) ? 'worksAsDefault' : 'missing';
}

const KINGDOMS: Record<AlternateGeneralRecord['force'], WikiAlternateGeneral['kingdom']> = { wei: 'Wei', shu: 'Shu', wu: 'Wu', qun: 'Qun' };
const KINGDOM_ORDER: readonly WikiAlternateGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];

export function wikiAlternateGenerals(): WikiAlternateGeneral[] {
  return alternateGeneralRecords()
    .map((rec): WikiAlternateGeneral => {
      const counterpart = Object.prototype.hasOwnProperty.call(generalsData, rec.id) ? generalsData[rec.id] : undefined;
      const skills = rec.skills.map((s) => {
        const nameZh = s.nameZh ?? null;
        return { name: s.name, nameZh, text: s.text, status: alternateSkillStatus({ name: s.name, nameZh }, counterpart) };
      });
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
