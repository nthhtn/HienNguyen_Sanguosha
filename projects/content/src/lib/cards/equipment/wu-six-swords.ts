import { kingdomWarsCardData } from '../../kingdomWarsCards';
import { sameKingdomSeatIds } from '../../shared/kingdom';
import { makeEquipmentCard } from './index';

// Six Swords of Wu: while equipped, every other player of the owner's Kingdom has +1 attack
// range. The owner's own range is exactly the sword's 2: it gets no bonus.
export const wuSixSwordsCard = makeEquipmentCard('wu-six-swords', 'Six Swords of Wu', 'weapon', kingdomWarsCardData('wu-six-swords')?.range ?? 2, {
  abilities: {
    modifiers: {
      attackRangeBonusTo: (state, ownerSeatId, seatId) => (seatId !== ownerSeatId && sameKingdomSeatIds(state, ownerSeatId).includes(seatId) ? 1 : 0),
    },
  },
});
