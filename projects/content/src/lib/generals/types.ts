import type { SkillDefinition } from 'engine';

// The hand-coded half of a general: only its skill logic. Its id, kingdom and
// maxHp come from the general's data file (projects/content/data/generals).
export interface GeneralSkillSet {
  id: string;
  skills: SkillDefinition[];
}
