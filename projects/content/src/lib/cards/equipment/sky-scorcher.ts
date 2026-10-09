import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';

// Sky Scorcher: when its wearer's Sha is their last hand card, it may take up
// to 2 more targets within attack range, picked with the first (Sha's
// targetPick). Each target then goes through the steps on its own.
export const skyScorcherCard = makeEquipmentCard('sky-scorcher', 'Sky Scorcher', 'weapon', cardsData['sky-scorcher'].range, {
  abilities: { modifiers: { extraShaTargetsWhenLastCard: 2 } },
});
