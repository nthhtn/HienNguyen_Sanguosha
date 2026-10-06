import type { Abilities, CardDefinition, Effect, EquipSlot, GameState } from 'engine';
import { requireZoneOfKind } from 'engine';
import { cardsData } from '../../../data/cards';

// Every equipment card's slot, keyed by definition id. play() has no registry
// access, so this is how an equip finds the slot of the card already worn.
const EQUIP_SLOT_BY_ID = new Map<string, EquipSlot>();

export function equipSlotOf(definitionId: string): EquipSlot | null {
  return EQUIP_SLOT_BY_ID.get(definitionId) ?? null;
}

interface EquipmentExtras {
  abilities?: Abilities;
  onUnequip?: CardDefinition['onUnequip'];
}

export function makeEquipmentCard(id: string, name: string, equipSlot: EquipSlot, weaponRange?: number, extras: EquipmentExtras = {}): CardDefinition {
  EQUIP_SLOT_BY_ID.set(id, equipSlot);
  return {
    id,
    name,
    category: 'equipment',
    equipSlot,
    ...(weaponRange !== undefined ? { weaponRange } : {}),
    ...(extras.abilities ? { abilities: extras.abilities } : {}),
    ...(extras.onUnequip ? { onUnequip: extras.onUnequip } : {}),
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

const HORSE_IDS = ['di-lu', 'shadow-runner', 'storm-runner', 'hua-liu', 'red-hare', 'da-yuan', 'zi-xing'];

// Horses: the data's `mount` names the slot. Distance is read from the slot (seatDistance).
export const horseCards: CardDefinition[] = HORSE_IDS.map((id) => {
  const data = cardsData[id];
  if (!data?.mount) throw new Error(`Horse "${id}" has no mount in the data`);
  return makeEquipmentCard(id, data.name, data.mount === 'defensive' ? 'defensiveMount' : 'offensiveMount');
});

// Crossbow: any number of Sha a turn while worn.
export const crossbowCard = makeEquipmentCard('crossbow', 'Crossbow', 'weapon', cardsData['crossbow'].range, {
  abilities: { modifiers: { shaLimit: Number.POSITIVE_INFINITY } },
});

// Black Pommel: the target's armour has no effect on your Sha's damage.
export const blackPommelCard = makeEquipmentCard('black-pommel', 'Black Pommel', 'weapon', cardsData['black-pommel'].range, {
  abilities: { modifiers: { ignoresArmor: true } },
});
