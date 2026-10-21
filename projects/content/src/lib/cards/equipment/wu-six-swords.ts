import { alternateCardData } from '../../alternateCards';
import { sameKingdomSeatIds } from '../../shared/kingdom';
import { makeEquipmentCard } from './index';

// Six Swords of Wu: while equipped, its owner and every other player of the owner's Kingdom
// (the owner alone with no exposed General) have +1 attack range.
export const wuSixSwordsCard = makeEquipmentCard('wu-six-swords', 'Six Swords of Wu', 'weapon', alternateCardData('wu-six-swords')?.range ?? 2, {
  abilities: {
    modifiers: {
      attackRangeBonusTo: (state, ownerSeatId, seatId) => (sameKingdomSeatIds(state, ownerSeatId).includes(seatId) ? 1 : 0),
    },
  },
});
