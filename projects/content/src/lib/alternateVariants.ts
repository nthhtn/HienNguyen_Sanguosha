import type { SkillDefinition } from 'engine';
import { ALTERNATE_QUN_VARIANTS } from './generals/alternate-qun';
import { ALTERNATE_SHU_VARIANTS } from './generals/alternate-shu';
import { ALTERNATE_WEI_VARIANTS } from './generals/alternate-wei';
import { ALTERNATE_WU_VARIANTS } from './generals/alternate-wu';

// Alternate skills whose rules differ from Default's: General id, then the Alternate skill's Chinese
// name, to the variant. Assembled from the per-force files; a new force file is one import and one spread.
export const ALTERNATE_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  ...ALTERNATE_QUN_VARIANTS,
  ...ALTERNATE_SHU_VARIANTS,
  ...ALTERNATE_WEI_VARIANTS,
  ...ALTERNATE_WU_VARIANTS,
};
