// A leaf module: display.ts and the bots import it, so it must import no variant file and no Default skill file.
// Variant skill id -> the Default skill id whose texts and bot behaviour it shares. One entry per variant;
// a variant with nothing in common to inherit has none.
export const ALTERNATE_VARIANT_BASE: Readonly<Record<string, string>> = {
  'alternate:benevolence': 'kindness',
  'alternate:balance-of-power': 'reconsider',
  'alternate:eternal-loyalty': 'eternal-loyalty',
  'alternate:assembling-wisdom': 'gathering-wisdom',
  'alternate:fearsome-blade': 'intense-edge',
  'alternate:warrior-lady': 'armed-consorts',
  'alternate:seed-of-animosity': 'sow-discord',
  'alternate:envious-moon': 'eclipse-the-moon',
  'alternate:empty-city': 'empty-city',
  'alternate:stabilization': 'stubborn',
  'alternate:humility': 'humility',
  'alternate:behind-the-curtain': 'curtain',
  // Bots only: it asks like Bestowed Rouse; its own prompts and hints are in display.ts.
  'alternate:bequeathed-strategy': 'bestowed-rouse',
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
