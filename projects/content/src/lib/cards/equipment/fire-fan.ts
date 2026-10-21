import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';

// Fire Fan: when its wearer uses a plain Slash, they may make it a Fire Attack.
// Asked at the Sha's first step, once per Slash (not per target). A Slash played
// as an answer (a Duel, Barbarians) has no such step, and a Fire or Lightning
// Attack already has a nature. A converted Slash is plain, so it is offered too.
export const fireFanCard = makeEquipmentCard('fire-fan', 'Fire Fan', 'weapon', cardsData['fire-fan'].range, {
  abilities: {
    triggers: [
      atStep(['sha-use'], {
        condition: (_state, step, owner) => step.userSeatId === owner.seatId && step.card.as === 'sha' && !step.card.nature,
        effect: (_state, step, owner) => {
          const fire = actedOn({ ...step, card: { ...step.card, nature: 'fire' } }, owner);
          return [askAtStep(owner, 'fire-fan', step, [fire], null)];
        },
      }),
    ],
  },
});
