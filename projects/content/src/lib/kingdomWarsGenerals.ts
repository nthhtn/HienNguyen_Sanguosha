import aggregate from '../../data/decks/kingdom-wars/generals.json';
import differences from '../../data/decks/kingdom-wars/differences.json';

// The Kingdom Wars deck's Generals as the crawl saved them (generals.json, in the blog's order).
// HP and gender come from Dynasty Wars' General or from generals-manual.json (`hpFrom` says which).
export interface KingdomWarsGeneralSkillRecord {
  name: string;
  nameZh?: string;
  text: string;
  tag?: string;
}

export interface KingdomWarsGeneralRecord {
  id: string;
  name: string;
  nameZh?: string;
  force: 'wei' | 'shu' | 'wu' | 'qun';
  title?: string;
  maxHp: number;
  gender: 'male' | 'female';
  hpFrom: 'dynastyWars' | 'manual';
  skills: KingdomWarsGeneralSkillRecord[];
  synergisticPartners: string[];
  differenceFromNormal: string | null;
}

const RECORDS = aggregate.generals as KingdomWarsGeneralRecord[];

// What differs from Dynasty Wars, written by hand against the rules in the engine (differences.json).
// It is what the wiki shows; each record's crawled `differenceFromNormal` is kept but no longer used.
export const kingdomWarsDifferenceNote = (id: string): string | null => (differences as Record<string, string>)[id] ?? null;

export const kingdomWarsGeneralRecords = (): KingdomWarsGeneralRecord[] => RECORDS;
export const kingdomWarsGeneralIds = (): string[] => RECORDS.map((g) => g.id);
