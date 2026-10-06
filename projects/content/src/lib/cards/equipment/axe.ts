import type { AbilityOwner, GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { handOf } from '../../shared/queries';
import { shaStep } from '../sha';

// The cards Axe may discard: its wearer's hand and its other worn cards.
function axeCosts(state: GameState, owner: AbilityOwner): string[] {
  const seat = state.seats.find((s) => s.id === owner.seatId);
  const worn = (seat && state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards) ?? [];
  const axeId = owner.kind === 'equipment' ? owner.cardInstanceId : '';
  return [...handOf(state, owner.seatId), ...worn].filter((c) => c.instanceId !== axeId).map((c) => c.instanceId);
}

// Axe: at step 4, when its user's Sha is dodged, the user may discard 2 other
// cards (hand or equipment) to make it hit anyway.
export const axeCard = makeEquipmentCard('axe', 'Axe', 'weapon', cardsData['axe'].range, {
  abilities: {
    triggers: [
      atStep(['sha-dodged'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && axeCosts(state, owner).length >= 2,
        effect: (state, step, owner) => [
          askAtStep(owner, 'axe', step, [
            {
              kind: 'OpenSelectionEffect',
              selection: {
                id: `axe-${owner.seatId}-${state.log.length}`,
                seatId: owner.seatId,
                reason: { kind: 'ability', owner, abilityId: 'axe', targetSeatId: step.target.seatId },
                of: 'cards',
                eligibleIds: axeCosts(state, owner),
                min: 2,
                max: 2,
                then: { kind: 'discard', then: [shaStep(step, 'sha-hit')] },
                onCancel: [actedOn(step, owner)],
              },
            },
          ]),
        ],
      }),
    ],
  },
});
