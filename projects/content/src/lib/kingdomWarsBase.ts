// A leaf module: display.ts and the bots import it, so it must import no variant file and no Dynasty Wars skill file.
// Variant skill id -> the Dynasty Wars skill id whose texts and bot behaviour it shares. One entry per variant;
// a variant with nothing in common to inherit has none.
export const KINGDOM_WARS_VARIANT_BASE: Readonly<Record<string, string>> = {
  'kingdomWars:benevolence': 'kindness',
  'kingdomWars:balance-of-power': 'reconsider',
  'kingdomWars:eternal-loyalty': 'eternal-loyalty',
  'kingdomWars:assembling-wisdom': 'gathering-wisdom',
  'kingdomWars:fearsome-blade': 'intense-edge',
  'kingdomWars:warrior-lady': 'armed-consorts',
  'kingdomWars:seed-of-animosity': 'sow-discord',
  'kingdomWars:envious-moon': 'eclipse-the-moon',
  'kingdomWars:empty-city': 'empty-city',
  'kingdomWars:stabilization': 'stubborn',
  'kingdomWars:humility': 'humility',
  // Bots (always judge again) and the Devil bot's reading of a black card as good for her; its own hint and outcome texts are in display.ts.
  'kingdomWars:goddess-luo': 'river-goddess',
  'kingdomWars:behind-the-curtain': 'curtain',
  // Bots and texts; its own choice prompt and history outcomes are in display.ts and the app.
  'kingdomWars:sorrow': 'heartbroken',
  // Bots only: it asks like Bestowed Rouse; its own prompts and hints are in display.ts.
  'kingdomWars:bequeathed-strategy': 'bestowed-rouse',
  // Same prompts and bot behaviour as Upheaval; the bots' picks come from the legal choices, so they follow the nearest-seat list.
  'kingdomWars:descend-into-chaos': 'upheaval',
  // Same texts and bot behaviour as Lightning Strike; the bot picks among the seats it is offered.
  'kingdomWars:lightning-strike': 'lightning-strike',
  // Same bot behaviour as Nirvana; its own hint says it also clears Chained.
  'kingdomWars:resurrection': 'nirvana',
  // Ma Teng's Horsemanship is Ma Chao's: same texts and modifier.
  'kingdomWars:horsemanship': 'horsemanship',
};

// Variants with no Dynasty Wars counterpart, which therefore have no base entry (and need their own texts and bot support).
export const VARIANTS_WITHOUT_BASE: ReadonlySet<string> = new Set<string>([
  // Lu Xun's Scrutinize: a conversion into Amass; Dynasty Wars has no skill like it.
  'kingdomWars:scrutinize',
  // Gan Fu Ren is new in Kingdom Wars: both her skills have no Dynasty Wars counterpart.
  'kingdomWars:prudence',
  'kingdomWars:divine-wisdom',
  // Yue Jin is new in Kingdom Wars: Dauntless has no Dynasty Wars counterpart.
  'kingdomWars:dauntless',
  // Ding Feng is new in Kingdom Wars: both his skills have no Dynasty Wars counterpart.
  'kingdomWars:close-combat',
  'kingdomWars:swift-and-deadly',
  // Pan Feng is new in Kingdom Wars: Insanity Axe has no Dynasty Wars counterpart.
  'kingdomWars:insanity-axe',
  // Tian Feng is new in Kingdom Wars: both his skills have no Dynasty Wars counterpart.
  'kingdomWars:deathly-counsel',
  'kingdomWars:with-the-tide',
  // Kong Rong is new in Kingdom Wars: both his skills have no Dynasty Wars counterpart.
  'kingdomWars:celebrity',
  'kingdomWars:comity',
  // Ma Teng is new in Kingdom Wars: Call of Valour has no Dynasty Wars counterpart.
  'kingdomWars:call-of-valour',
  // Ji Ling is new in Kingdom Wars: Double Edged has no Dynasty Wars counterpart.
  'kingdomWars:double-edged',
  // Zou Shi is new in Kingdom Wars: both her skills have no Dynasty Wars counterpart.
  'kingdomWars:femme-fatale',
  'kingdomWars:impetus-for-conflicts',
]);

// The Dynasty Wars skill id a skill id shares texts and bot behaviour with: its base when it is a variant, else itself.
export const baseSkillId = (skillId: string): string =>
  Object.prototype.hasOwnProperty.call(KINGDOM_WARS_VARIANT_BASE, skillId) ? KINGDOM_WARS_VARIANT_BASE[skillId] : skillId;

// An own entry of a table for a skill id: the id's own entry first, else its base's.
export function lookupWithBase<T>(table: Readonly<Record<string, T>> | undefined, skillId: string): T | undefined {
  if (!table) return undefined;
  for (const id of [skillId, baseSkillId(skillId)]) if (Object.prototype.hasOwnProperty.call(table, id)) return table[id];
  return undefined;
}
