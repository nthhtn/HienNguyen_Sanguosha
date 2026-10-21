import aggregate from '../../data/decks/alternate/generals.json';

// The Alternate deck's Generals as the crawl saved them (generals.json, in the blog's order).
// HP and gender come from Default's General or from generals-manual.json (`hpFrom` says which).
export interface AlternateGeneralSkillRecord {
  name: string;
  nameZh?: string;
  text: string;
  tag?: string;
}

export interface AlternateGeneralRecord {
  id: string;
  name: string;
  nameZh?: string;
  force: 'wei' | 'shu' | 'wu' | 'qun';
  title?: string;
  maxHp: number;
  gender: 'male' | 'female';
  hpFrom: 'default' | 'manual';
  skills: AlternateGeneralSkillRecord[];
  synergisticPartners: string[];
  differenceFromNormal: string | null;
}

const RECORDS = aggregate.generals as AlternateGeneralRecord[];

export const alternateGeneralRecords = (): AlternateGeneralRecord[] => RECORDS;
export const alternateGeneralIds = (): string[] => RECORDS.map((g) => g.id);
