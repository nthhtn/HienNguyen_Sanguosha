import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './setOne';
import { zhaoYunGeneral, huangYueyingGeneral } from './setTwo';

const HAND_CODED: GeneralSkillSet[] = [
  xiahouDunGeneral,
  sunShangxiangGeneral,
  zhugeLiangGeneral,
  zhaoYunGeneral,
  huangYueyingGeneral,
];

// Skill logic keyed by general id. A general with data but no entry here is a
// playable vanilla general (skills: []).
export const GENERAL_SKILLS: ReadonlyMap<string, SkillDefinition[]> = new Map(
  HAND_CODED.map((g) => [g.id, g.skills])
);
