import type { SkillDefinition } from 'engine';
import { ALTERNATE_SHU_VARIANTS } from './generals/alternate-shu';
import { ALTERNATE_WEI_VARIANTS } from './generals/alternate-wei';
import { ALTERNATE_WU_VARIANTS } from './generals/alternate-wu';

// Alternate skills whose rules differ from Default's: General id, then the Alternate skill's Chinese
// name, to the variant. Assembled from the per-force files; a new force file is one import and one spread.
export const ALTERNATE_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  ...ALTERNATE_SHU_VARIANTS,
  ...ALTERNATE_WEI_VARIANTS,
  ...ALTERNATE_WU_VARIANTS,
};

// Variant skill id -> the Default skill id whose texts and bot behaviour it shares. One entry per variant;
// a variant with nothing in common to inherit has none.
export const ALTERNATE_VARIANT_BASE: Readonly<Record<string, string>> = {
  'alternate:benevolence': 'kindness',
  'alternate:balance-of-power': 'reconsider',
  'alternate:eternal-loyalty': 'eternal-loyalty',
};

// Variants with no Default counterpart, which therefore have no base entry (and need their own texts and bot support).
export const VARIANTS_WITHOUT_BASE: ReadonlySet<string> = new Set<string>();

// The Default skill id a skill id shares texts and bot behaviour with: its base when it is a variant, else itself.
export const baseSkillId = (skillId: string): string =>
  Object.prototype.hasOwnProperty.call(ALTERNATE_VARIANT_BASE, skillId) ? ALTERNATE_VARIANT_BASE[skillId] : skillId;

// An own entry of a table for a skill id: the id's own entry first, else its base's.
export function lookupWithBase<T>(table: Readonly<Record<string, T>> | undefined, skillId: string): T | undefined {
  if (!table) return undefined;
  for (const id of [skillId, baseSkillId(skillId)]) if (Object.prototype.hasOwnProperty.call(table, id)) return table[id];
  return undefined;
}
