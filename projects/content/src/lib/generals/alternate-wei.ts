import type { SkillDefinition } from 'engine';
import { makeEternalLoyalty } from './fire';

// Alternate Wei skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_WEI_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Eternal Loyalty: the picked seat's hand is raised to at most 5 cards (Default: its max HP, however high).
  'xun-yu': { 节命: { ...makeEternalLoyalty(5), id: 'alternate:eternal-loyalty' } },
};
