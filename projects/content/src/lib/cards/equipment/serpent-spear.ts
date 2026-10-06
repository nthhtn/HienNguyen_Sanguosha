import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';

// Serpent Spear: whenever its wearer could play or use a Sha, 2 hand cards may
// be used as one Sha (Play Phase, Duel, Barbarians, Coerce). Its colour comes
// from the two cards; in the Play Phase it counts toward the limit.
export const serpentSpearCard = makeEquipmentCard('serpent-spear', 'Serpent Spear', 'weapon', cardsData['serpent-spear'].range, {
  abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
});
