import type { ChoiceOption, Effect, GameState, UsedCard } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { holdsAnyCard, seatCardOptions } from '../../shared/choices';
import { ownerCard } from '../../shared/abilities';

// The options left once `taken` is picked: one card fewer in the hand, or that card gone.
function remainingAfter(options: ChoiceOption[], taken: ChoiceOption): ChoiceOption[] {
  return options.flatMap((o) => {
    if (o.id !== taken.id) return [o];
    if (o.shows.kind === 'hidden-hand' && o.shows.count > 1) return [{ ...o, shows: { ...o.shows, count: o.shows.count - 1 } }];
    return [];
  });
}

// Two discards from `targetSeatId`, one pick at a time, as Break picks (the
// hand face down, worn and judgment cards face up). One, if it has only one.
function discardTwo(state: GameState, userSeatId: string, targetSeatId: string, sword: UsedCard): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const first = seatCardOptions(state, targetSeatId, discardPileId);
  const choice = (id: string, options: ChoiceOption[]): Effect => ({
    kind: 'OpenChoiceEffect',
    choice: { id, seatId: userSeatId, reason: { kind: 'choice', card: sword, userSeatId, targetSeatId }, verb: 'discard', options },
  });
  const base = `ice-sword-${targetSeatId}-${state.log.length}`;
  const withSecond = first.map((option) => {
    const rest = remainingAfter(first, option);
    return { ...option, effects: [...option.effects, ...(rest.length > 0 ? [choice(`${base}-2-${option.id}`, rest)] : [])] };
  });
  return withSecond.length > 0 ? [choice(`${base}-1`, withSecond)] : [];
}

// Ice Sword: at step 5, its user may prevent the damage and instead discard 2
// of the target's cards. Only if the target holds a card.
export const iceSwordCard = makeEquipmentCard('ice-sword', 'Ice Sword', 'weapon', cardsData['ice-sword'].range, {
  abilities: {
    triggers: [
      atStep(['sha-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && holdsAnyCard(state, step.target.seatId),
        effect: (state, step, owner) => {
          const worn = ownerCard(state, owner);
          return worn ? [askAtStep(owner, 'ice-sword', step, discardTwo(state, owner.seatId, step.target.seatId, usedCardOf(worn)))] : [actedOn(step, owner)];
        },
      }),
    ],
  },
});
