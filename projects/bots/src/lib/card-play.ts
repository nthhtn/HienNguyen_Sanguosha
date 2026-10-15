import type { ContentRegistry, GameState, Seat } from 'engine';
import { definitionIdOf, handCards, isAlly } from './helpers';

// The Stage 1 card-play rules, each a switch (see the stage 1 spec). All off is the original bot.
export interface CardPlayRules {
  peach: boolean;
  wine: boolean;
  equipment: boolean;
  discard: boolean;
}

export const NO_CARD_PLAY_RULES: CardPlayRules = { peach: false, wine: false, equipment: false, discard: false };
export const ALL_CARD_PLAY_RULES: CardPlayRules = { peach: true, wine: true, equipment: true, discard: true };

// R1: whether a Peach is worth playing now, for a bot below max HP. At 2 HP or less, or holding more
// hand cards than its HP; but its last Peach stays while a revealed ally is at 2 HP or less.
export function peachWorthPlaying(view: GameState, self: Seat): boolean {
  const held = handCards(view, self);
  const peaches = held.filter((c) => c.definitionId === 'peach').length;
  const allyInDanger = view.seats.some((s) => s.id !== self.id && !s.eliminated && isAlly(self, s) && s.combinedHp <= 2);
  if (peaches <= 1 && allyInDanger) return false;
  return self.combinedHp <= 2 || held.length > self.combinedHp;
}

// R2: Wine only when the Sha it boosts goes to a target at 2 HP or less, so the extra point is lethal.
export function wineWorthPlaying(shaTarget: Seat | undefined): boolean {
  return !!shaTarget && shaTarget.combinedHp <= 2;
}

// R3: worth of a weapon or armor within its slot (higher is better). Crossbow lifts the Sha limit, which this bot uses.
const ARMOR_ORDER = ['eight-trigrams', 'silver-lion', 'black-shield', 'wood-armor'];
const CROSSBOW_VALUE = 4;

function equipValue(registry: ContentRegistry, definitionId: string): number {
  const definition = registry.cards.get(definitionId);
  if (definition?.equipSlot === 'weapon') return definitionId === 'crossbow' ? CROSSBOW_VALUE : (definition.weaponRange ?? 1);
  if (definition?.equipSlot === 'armor') {
    const index = ARMOR_ORDER.indexOf(definitionId);
    return index < 0 ? 0 : ARMOR_ORDER.length - index;
  }
  return 0;
}

// Whether the card is better than the one worn in its slot. Mounts are never replaced, and an empty
// slot is not an upgrade (the bot already fills those).
export function isEquipUpgrade(registry: ContentRegistry, newDefinitionId: string, wornDefinitionIds: string[]): boolean {
  const slot = registry.cards.get(newDefinitionId)?.equipSlot;
  if (slot !== 'weapon' && slot !== 'armor') return false;
  const worn = wornDefinitionIds.find((id) => registry.cards.get(id)?.equipSlot === slot);
  return worn !== undefined && equipValue(registry, newDefinitionId) > equipValue(registry, worn);
}

// R4: higher = discard later. Used only at the Discard phase; `keepRank` stays for the skills.
export function discardRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (!definitionId) return 0;
  switch (definitionId) {
    case 'peach':
      return 6;
    case 'shan':
    case 'wuxie':
      return 5;
    case 'sha':
      return 4;
    case 'wine':
      return 3;
  }
  const category = registry.cards.get(definitionId)?.category;
  return category === 'tool' ? 2 : category === 'equipment' ? 1 : 0;
}
