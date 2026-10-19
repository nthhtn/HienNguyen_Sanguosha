import type { AbilityOwner, Effect, GameState } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { equipSlotOf, makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { ownerCard } from '../../shared/abilities';

const mountsOf = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = (seat && state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards) ?? [];
  return worn.filter((c) => equipSlotOf(c.definitionId) === 'defensiveMount' || equipSlotOf(c.definitionId) === 'offensiveMount');
};

// Discard one of the target's Mounts: the only one, or the user's pick of two.
function discardAMount(state: GameState, step: CardStep, owner: AbilityOwner): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const mounts = mountsOf(state, step.target.seatId);
  const bow = ownerCard(state, owner);
  if (mounts.length === 1 || !bow) return [{ kind: 'MoveCardEffect', cardInstanceId: mounts[0].instanceId, toZoneId: discardPileId }];
  return [
    {
      kind: 'OpenChoiceEffect',
      choice: {
        id: `longbow-${step.target.seatId}-${state.log.length}`,
        seatId: owner.seatId,
        reason: { kind: 'choice', card: usedCardOf(bow), userSeatId: owner.seatId, targetSeatId: step.target.seatId },
        verb: 'discard',
        options: mounts.map((m) => ({
          id: m.instanceId,
          shows: { kind: 'card' as const, card: m },
          effects: [{ kind: 'MoveCardEffect' as const, cardInstanceId: m.instanceId, toZoneId: discardPileId }],
        })),
      },
    },
  ];
}

// Longbow: at step 6, after its user's Sha damages a seat, the user may
// discard one of that seat's Mounts.
// Step 6, like every follow-up a Sha queues after its damage, runs after that damage's chain wave.
export const longbowCard = makeEquipmentCard('longbow', 'Longbow', 'weapon', cardsData['longbow'].range, {
  abilities: {
    triggers: [
      atStep(['sha-after-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && mountsOf(state, step.target.seatId).length > 0,
        effect: (state, step, owner) => [askAtStep(owner, 'longbow', step, [...discardAMount(state, step, owner), actedOn(step, owner)])],
      }),
    ],
  },
});
