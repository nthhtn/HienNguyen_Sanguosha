import { makeEquipmentCard } from './index';
import { stopsSha } from '../../shared/armor';

// Black Shield: a black Sha has no effect on its wearer. A Sha with no colour
// still does.
export const blackShieldCard = makeEquipmentCard('black-shield', 'Black Shield', 'armor', undefined, {
  abilities: { triggers: [stopsSha('black-shield', (step) => step.card.colour === 'black')] },
});
