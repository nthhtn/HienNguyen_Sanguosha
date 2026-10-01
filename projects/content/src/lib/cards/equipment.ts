import type { CardDefinition, Effect, EquipSlot, GameState } from 'engine';
import { requireZoneOfKind } from 'engine';
import { cardsData } from '../../../data/cards';

// Every equipment card's slot, keyed by definition id. play() has no registry
// access, so this is how an equip finds the slot of the card already worn.
const EQUIP_SLOT_BY_ID = new Map<string, EquipSlot>();

export function equipSlotOf(definitionId: string): EquipSlot | null {
  return EQUIP_SLOT_BY_ID.get(definitionId) ?? null;
}

function makeEquipmentCard(id: string, name: string, equipSlot: EquipSlot, weaponRange?: number): CardDefinition {
  EQUIP_SLOT_BY_ID.set(id, equipSlot);
  return {
    id,
    name,
    category: 'equipment',
    equipSlot,
    ...(weaponRange !== undefined ? { weaponRange } : {}),
    legalPlayTargets: () => [[]],
    // One card per slot: whatever already fills this slot goes to the discard
    // pile first, then the played card is equipped.
    play: (state: GameState, ctx) => {
      const equipZoneId = `${ctx.seatId}:equip`;
      const worn = state.zones.find((z) => z.id === equipZoneId)?.cards ?? [];
      const replaced = worn.filter((c) => equipSlotOf(c.definitionId) === equipSlot);
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      const effects: Effect[] = replaced.map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: discardPile.id }));
      effects.push({ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: equipZoneId });
      return effects;
    },
  };
}

export const silverLionCard = makeEquipmentCard('silver-lion', 'Silver Lion', 'armor');
export const greenDragonBladeCard = makeEquipmentCard(
  'green-dragon-blade',
  'Green Dragon Blade',
  'weapon',
  cardsData['green-dragon-blade'].range
);
