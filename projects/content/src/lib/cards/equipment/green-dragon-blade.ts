import type { ContentRegistry, GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { handOf, isShaCard } from '../../shared/queries';

// The Sha cards in the hand, elemental Sha included.
const shasIn = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => isShaCard(registry, c.definitionId)).map((c) => c.instanceId);

// Green Dragon Blade: at step 4, when its user's Sha is dodged, the user may
// play another Sha at the same target. It ignores range, doesn't count toward
// the limit, and starts at step 1 (so this can repeat).
export const greenDragonBladeCard = makeEquipmentCard('green-dragon-blade', 'Green Dragon Blade', 'weapon', cardsData['green-dragon-blade'].range, {
  abilities: {
    triggers: [
      atStep(['sha-dodged'], {
        condition: (state, step, owner, registry) =>
          step.userSeatId === owner.seatId && shasIn(state, owner.seatId, registry).length > 0 && state.seats.some((s) => s.id === step.target.seatId && !s.eliminated),
        effect: (state, step, owner, registry) => [
          askAtStep(owner, 'green-dragon-blade', step, [
            {
              kind: 'OpenSelectionEffect',
              selection: {
                id: `green-dragon-blade-${owner.seatId}-${state.log.length}`,
                seatId: owner.seatId,
                reason: { kind: 'ability', owner, abilityId: 'green-dragon-blade', targetSeatId: step.target.seatId },
                of: 'cards',
                eligibleIds: shasIn(state, owner.seatId, registry),
                min: 1,
                max: 1,
                then: { kind: 'use-card', targets: [step.target], counted: false, free: true },
                onCancel: [actedOn(step, owner)],
              },
            },
          ]),
        ],
      }),
    ],
  },
});
