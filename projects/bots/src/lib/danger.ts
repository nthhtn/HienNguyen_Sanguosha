import { baseGeneralId, skillDanger } from 'content';
import type { SkillDanger } from 'content';
import type { ContentRegistry } from 'engine';
import { GENERAL_VALUES } from './general-values';

const WEIGHT: Record<SkillDanger, number> = { high: 2, medium: 1, low: 0 };
// How many points one unit of the measured General value is worth next to the hand ratings.
const VALUE_SCALE = 10;

// Rule 4: a General's danger = its highest skill rating weight (Lord skills are not rated; an unrated skill
// counts 0) + 10 x its value in the General value table (by base id; absent counts 0).
export function generalDanger(generalId: string, registry: ContentRegistry): number {
  const skills = registry.generals.get(generalId)?.skills ?? [];
  const weight = skills.reduce((max, s) => {
    const rating = s.lord ? undefined : skillDanger(s.id);
    return Math.max(max, rating ? WEIGHT[rating] : 0);
  }, 0);
  return weight + VALUE_SCALE * (GENERAL_VALUES[baseGeneralId(generalId)] ?? 0);
}

// The `(generalId) => number` the table functions (seatDanger) take.
export function dangerOf(registry: ContentRegistry): (generalId: string) => number {
  return (generalId) => generalDanger(generalId, registry);
}
