import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, atStep } from '../../shared/steps';
import { handOf } from '../../shared/queries';
import { shaData } from '../sha';

// Ancient Scimitar: at step 5, its user's Sha deals 1 extra damage to a target
// with no hand cards. Added to the step, so Silver Lion's cap comes after it.
export const ancientScimitarCard = makeEquipmentCard('ancient-scimitar', 'Ancient Scimitar', 'weapon', cardsData['ancient-scimitar'].range, {
  abilities: {
    triggers: [
      atStep(['sha-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && handOf(state, step.target.seatId).length === 0,
        effect: (_state, step, owner) => [actedOn({ ...step, data: { ...step.data, extra: (shaData(step).extra ?? 0) + 1 } }, owner)],
      }),
    ],
  },
});
