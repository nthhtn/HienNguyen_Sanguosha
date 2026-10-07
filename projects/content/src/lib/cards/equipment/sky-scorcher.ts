import type { ContentRegistry, GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { attackRange, seatDistance } from '../../shared/queries';
import { shaData } from '../sha';
import { untargetableBy } from '../../shared/abilities';

// Living seats other than the user and the Sha's target, within the user's attack range, in seat order.
function extraTargets(state: GameState, step: CardStep, registry: ContentRegistry): string[] {
  const range = attackRange(state, step.userSeatId, registry);
  return [...state.seats]
    .sort((a, b) => a.index - b.index)
    .filter((s) => !s.eliminated && s.id !== step.userSeatId && s.id !== step.target.seatId && seatDistance(state, step.userSeatId, s.id, registry) <= range && !untargetableBy(state, s.id, 'sha', registry))
    .map((s) => s.id);
}

// Sky Scorcher: when its user plays their last hand card as a Sha in their
// Play Phase, they may add up to 2 more targets within attack range. Each
// target then goes through the steps on its own, in seat order from the user.
export const skyScorcherCard = makeEquipmentCard('sky-scorcher', 'Sky Scorcher', 'weapon', cardsData['sky-scorcher'].range, {
  abilities: {
    triggers: [
      atStep(['sha-use'], {
        condition: (state, step, owner, registry) =>
          step.userSeatId === owner.seatId && shaData(step).lastHandCard === true && extraTargets(state, step, registry).length > 0,
        effect: (state, step, owner, registry) => [
          askAtStep(
            owner,
            'sky-scorcher',
            step,
            [
              {
                kind: 'OpenSelectionEffect',
                selection: {
                  id: `sky-scorcher-${owner.seatId}-${state.log.length}`,
                  seatId: owner.seatId,
                  reason: { kind: 'ability', owner, abilityId: 'sky-scorcher' },
                  of: 'seats',
                  eligibleIds: extraTargets(state, step, registry),
                  min: 1,
                  max: 2,
                  then: { kind: 'card-step', step: actedOn(step, owner) },
                  onCancel: [actedOn(step, owner)],
                },
              },
            ],
            null
          ),
        ],
      }),
    ],
  },
});
