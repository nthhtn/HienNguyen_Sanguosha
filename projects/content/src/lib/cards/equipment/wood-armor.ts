import { makeEquipmentCard } from './index';
import { stopsSha } from '../../shared/armor';

// Wood Armor: a Sha has no effect on its wearer, and Barbarians and Hail of
// Arrows skip it as a target. (Its fire weakness can't come up: no fire damage.)
export const woodArmorCard = makeEquipmentCard('wood-armor', 'Wood Armor', 'armor', undefined, {
  abilities: {
    triggers: [stopsSha('wood-armor', () => true)],
    modifiers: { untargetableBy: ['barbarians', 'hail-of-arrows'] },
  },
});
