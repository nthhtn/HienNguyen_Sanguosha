import type { SkillDefinition } from 'engine';
import { makeIntenseEdge } from './forest';
import { makeGatheringWisdom, makeKindness } from './shu';

// Alternate Shu skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_SHU_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Benevolence: heals at 3 cards given in the turn (Default: 2).
  'liu-bei': { 仁德: { ...makeKindness(3), id: 'alternate:benevolence' } },
  // Fearsome Blade: only when the damaged seat is one the Slash was aimed at.
  // Assembling Wisdom: no draw for a Tool converted from other cards. Genius is unchanged (cleared wording).
  'huang-yueying': { 集智: { ...makeGatheringWisdom(false), id: 'alternate:assembling-wisdom' } },
  'zhu-rong': { 烈刃: { ...makeIntenseEdge(true), id: 'alternate:fearsome-blade' } },
};
