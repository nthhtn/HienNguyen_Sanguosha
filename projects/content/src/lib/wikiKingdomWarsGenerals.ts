import { kingdomWarsDifferenceNote, kingdomWarsGeneralRecords, type KingdomWarsGeneralRecord, type KingdomWarsGeneralSkillRecord } from './kingdomWarsGenerals';
import { kingdomWarsSkillFor, hasKingdomWarsVariant } from './kingdomWarsSkills';
import { splitIntoTabs, type WikiTab } from './wiki';

// Whether the game can play a Kingdom Wars skill: as its own variant ("worksAsKingdomWars"), as Dynasty Wars'
// version when the rules are the same ("worksAsDynastyWars"), or not yet ("missing").
export type KingdomWarsSkillStatus = 'worksAsDynastyWars' | 'worksAsKingdomWars' | 'missing';

export interface WikiKingdomWarsSkill {
  name: string;
  nameZh: string | null;
  text: string;
  status: KingdomWarsSkillStatus;
}

export interface WikiKingdomWarsGeneral {
  id: string;
  name: string;
  nameZh: string | null;
  title: string | null;
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun';
  maxHp: number;
  gender: 'male' | 'female';
  skills: WikiKingdomWarsSkill[];
  partners: string[];
  differenceNote: string | null;
  // Every skill is wired into the game (and there is at least one).
  skillsWorking: boolean;
}

export function kingdomWarsSkillStatus(record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): KingdomWarsSkillStatus {
  if (!kingdomWarsSkillFor(record, skill)) return 'missing';
  return hasKingdomWarsVariant(record, skill) ? 'worksAsKingdomWars' : 'worksAsDynastyWars';
}

const KINGDOMS: Record<KingdomWarsGeneralRecord['force'], WikiKingdomWarsGeneral['kingdom']> = { wei: 'Wei', shu: 'Shu', wu: 'Wu', qun: 'Qun' };
const KINGDOM_ORDER: readonly WikiKingdomWarsGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];

export function wikiKingdomWarsGenerals(): WikiKingdomWarsGeneral[] {
  return kingdomWarsGeneralRecords()
    .map((rec): WikiKingdomWarsGeneral => {
      const skills = rec.skills.map((s) => ({ name: s.name, nameZh: s.nameZh ?? null, text: s.text, status: kingdomWarsSkillStatus(rec, s) }));
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
        differenceNote: kingdomWarsDifferenceNote(rec.id),
        skillsWorking: skills.length > 0 && skills.every((s) => s.status !== 'missing'),
      };
    })
    .sort((a, b) => KINGDOM_ORDER.indexOf(a.kingdom) - KINGDOM_ORDER.indexOf(b.kingdom) || a.name.localeCompare(b.name));
}

export function wikiKingdomWarsGeneralTabs(): WikiTab<WikiKingdomWarsGeneral>[] {
  return splitIntoTabs(
    wikiKingdomWarsGenerals(),
    KINGDOM_ORDER.map((k) => ({ key: k.toLowerCase(), label: k, holds: (g: WikiKingdomWarsGeneral) => g.kingdom === k })),
  );
}
