import type { SkillDefinition } from 'engine';
import { ALTERNATE_SHU_VARIANTS } from './generals/alternate-shu';

// Alternate skills whose rules differ from Default's: General id, then the Alternate skill's Chinese
// name, to the variant. Assembled from the per-force files; a new force file is one import and one spread.
export const ALTERNATE_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  ...ALTERNATE_SHU_VARIANTS,
};
