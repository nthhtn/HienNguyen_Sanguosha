import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { WEI_GENERALS } from './wei';
import { SHU_GENERALS } from './shu';
import { WU_GENERALS } from './wu';
import { QUN_GENERALS } from './qun';
import { WIND_GENERALS } from './wind';
import { FIRE_GENERALS } from './fire';

const HAND_CODED: GeneralSkillSet[] = [...WEI_GENERALS, ...SHU_GENERALS, ...WU_GENERALS, ...QUN_GENERALS, ...WIND_GENERALS, ...FIRE_GENERALS];

// Skill logic keyed by general id. A general with data but no entry here is a
// playable vanilla general (skills: []).
export const GENERAL_SKILLS: ReadonlyMap<string, SkillDefinition[]> = new Map(HAND_CODED.map((g) => [g.id, g.skills]));

// The 25 base Generals (the standard edition), by force. Their skills are real;
// the expansions' wait for their own sub-projects.
export const BASE_GENERAL_IDS: readonly string[] = [
  'cao-cao', 'guo-jia', 'sima-yi', 'xiahou-dun', 'xu-chu', 'zhang-liao', 'zhen-ji',
  'guan-yu', 'huang-yueying', 'liu-bei', 'ma-chao', 'zhang-fei', 'zhao-yun', 'zhuge-liang',
  'da-qiao', 'gan-ning', 'huang-gai', 'lu-meng', 'lu-xun', 'sun-quan', 'sun-shangxiang', 'zhou-yu',
  'diao-chan', 'hua-tuo', 'lu-bu',
];

// The 8 Wind Generals (stage 8).
export const WIND_GENERAL_IDS: readonly string[] = ['cao-ren', 'xiahou-yuan', 'huang-zhong', 'wei-yan', 'xiao-qiao', 'zhou-tai', 'zhang-jiao', 'yu-ji'];

// The 8 Fire Generals (stage 9).
export const FIRE_GENERAL_IDS: readonly string[] = ['dian-wei', 'xun-yu', 'pang-tong', 'fire-zhuge-liang', 'taishi-ci', 'pang-de', 'yan-liang-and-wen-chou', 'yuan-shao'];
