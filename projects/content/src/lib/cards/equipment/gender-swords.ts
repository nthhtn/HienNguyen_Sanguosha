import type { AbilityOwner, Effect, GameState } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { seatGender } from '../../shared/gender';
import { handOf } from '../../shared/queries';
import { ownerCard } from '../../shared/abilities';

// The target's choice: discard one of its hand cards, or let the user draw 1.
// With no hand cards it must let the user draw.
function targetChooses(state: GameState, step: CardStep, owner: AbilityOwner): Effect[] {
  const draw: Effect = { kind: 'DrawCardsEffect', seatId: owner.seatId, count: 1 };
  const hand = handOf(state, step.target.seatId);
  const swords = ownerCard(state, owner);
  if (hand.length === 0 || !swords) return [draw];
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  return [
    {
      kind: 'OpenChoiceEffect',
      choice: {
        id: `gender-swords-${step.target.seatId}-${state.log.length}`,
        seatId: step.target.seatId,
        reason: { kind: 'choice', card: usedCardOf(swords), userSeatId: owner.seatId, targetSeatId: step.target.seatId },
        verb: 'discard',
        options: [
          ...hand.map((c) => ({
            id: c.instanceId,
            shows: { kind: 'card' as const, card: c },
            effects: [{ kind: 'MoveCardEffect' as const, cardInstanceId: c.instanceId, toZoneId: discardPileId }],
          })),
          { id: 'decline', shows: { kind: 'decline' as const }, effects: [draw] },
        ],
      },
    },
  ];
}

// Gender Swords: at step 1, when the target's gender differs from its user's,
// the user may make the target choose: discard a hand card, or let the user
// draw 1. A seat with no gender never differs.
export const genderSwordsCard = makeEquipmentCard('gender-swords', 'Gender Swords', 'weapon', cardsData['gender-swords'].range, {
  abilities: {
    triggers: [
      atStep(['sha-targeted'], {
        condition: (state, step, owner, registry) => {
          if (step.userSeatId !== owner.seatId) return false;
          const mine = seatGender(state, owner.seatId, registry);
          const theirs = seatGender(state, step.target.seatId, registry);
          return !!mine && !!theirs && mine !== theirs;
        },
        effect: (state, step, owner) => [askAtStep(owner, 'gender-swords', step, [...targetChooses(state, step, owner), actedOn(step, owner)])],
      }),
    ],
  },
});
