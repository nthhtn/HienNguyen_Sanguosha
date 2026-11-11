// Which Kingdom Wars cards and skills the bot knows how to play, other than through KINGDOM_WARS_RULES.
// Every id in the deck must be in exactly one of KINGDOM_WARS_RULES, LEGACY_HANDLED or IGNORED (coverage.spec.ts).

// Handled by the existing ladder (rule-based.ts) or by skills.ts, fire.ts, forest.ts, mountain.ts, wind.ts,
// responses.ts and card-play.ts. Passive equipment is here because the generic equip rule wears it.
export const LEGACY_HANDLED: readonly string[] = [
  // Cards: Basic, played or answered by the ladder (Fire and Lightning Attack count as Sha).
  'sha', 'fire-attack', 'lightning-attack', 'shan', 'peach', 'wine',
  // Cards: Tool.
  'lightning', 'capture', 'starvation', 'break', 'steal', 'duel', 'coerce', 'draw-two', 'wuxie',
  'hail-of-arrows', 'barbarians', 'peach-garden',
  // Cards: Weapon, Armor and Mount; none asks for a decision, or the ladder handles the ask.
  'crossbow', 'black-pommel', 'gender-swords', 'ice-sword', 'wu-six-swords', 'axe', 'serpent-spear', 'longbow',
  'eight-trigrams', 'black-shield', 'silver-lion', 'wood-armor',
  'shadow-runner', 'storm-runner', 'di-lu', 'da-yuan', 'red-hare', 'zi-xing',
  // Skills (not compulsory, not Lord) with an active, a conversion or a trigger.
  'astrology', 'fire-strategy', 'see-through', 'fighting-saint',
  'kingdomWars:assembling-wisdom', 'kingdomWars:prudence', 'kingdomWars:divine-wisdom',
  'strong-bow', 'decentralization', 'iron-cavalry', 'resurgence', 'shackle', 'kingdomWars:resurrection',
  'dragon-courage', 'kingdomWars:fearsome-blade', 'evil-hero', 'unnatural-death', 'exile', 'entrench',
  'assault', 'heavens-envy', 'kingdomWars:bequeathed-strategy', 'feedback', 'devil', 'unyielding',
  'godspeed', 'bare-the-chest', 'blockade', 'rouse-the-tiger', 'kingdomWars:eternal-loyalty',
  'kingdomWars:dauntless', 'clever-change', 'raid', 'overturned-country', 'kingdomWars:goddess-luo',
  'kingdomWars:balance-of-power', 'country-scene', 'displace', 'kingdomWars:swift-and-deadly', 'surprise',
  'battered-body', 'self-restraint', 'charity', 'alliance', 'kingdomWars:scrutinize', 'brave-spirit',
  'heavens-justice', 'marriage', 'kingdomWars:warrior-lady', 'fantasy', 'direct-instruction',
  'kingdomWars:stabilization', 'refusing-death', 'brave-gesture', 'sow-revolt', 'random-strike',
  'kingdomWars:lightning-strike', 'dark-magic', 'kingdomWars:seed-of-animosity', 'kingdomWars:envious-moon',
  'lament', 'first-aid', 'green-vesicle', 'kingdomWars:descend-into-chaos', 'kingdomWars:double-edged',
  'kingdomWars:comity', 'kingdomWars:call-of-valour', 'kingdomWars:insanity-axe', 'sudden-attack',
  'kingdomWars:deathly-counsel', 'dueling-heroes',
];

// Ids the bot deliberately has no rule for, each with a one-line reason. Empty: nothing in the deck is unplayed.
export const IGNORED: Readonly<Record<string, string>> = {};
