import type { SkillDefinition } from 'engine';
import { KINGDOM_WARS_QUN_VARIANTS } from './generals/kingdom-wars-qun';
import { KINGDOM_WARS_SHU_VARIANTS } from './generals/kingdom-wars-shu';
import { KINGDOM_WARS_WEI_VARIANTS } from './generals/kingdom-wars-wei';
import { KINGDOM_WARS_WU_VARIANTS } from './generals/kingdom-wars-wu';

// Kingdom Wars skills whose rules differ from Dynasty Wars': General id, then the Kingdom Wars skill's Chinese
// name, to the variant. Assembled from the per-force files; a new force file is one import and one spread.
export const KINGDOM_WARS_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  ...KINGDOM_WARS_QUN_VARIANTS,
  ...KINGDOM_WARS_SHU_VARIANTS,
  ...KINGDOM_WARS_WEI_VARIANTS,
  ...KINGDOM_WARS_WU_VARIANTS,
};
