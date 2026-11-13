import type { AbilityOwner, Effect, GameState } from 'engine';
import { usedCardOf } from 'engine';
import type { DamageDealtEvent } from 'engine';
import { kingdomWarsCardData } from '../../kingdomWarsCards';
import { makeEquipmentCard } from './index';
import { ownerCard } from '../../shared/abilities';
import { handOf, seatDistance } from '../../shared/queries';
import { seatOptions } from '../../shared/skills';
import { cardStep } from '../../shared/steps';
import type { CardStep } from '../../shared/steps';

type Registry = Parameters<typeof seatDistance>[3];

// The living seats Trident Glaive may hit: next to the damaged seat (ordinary distance 1),
// never that seat itself. Its wearer counts when they sit there.
function neighboursOf(state: GameState, targetSeatId: string, registry: Registry): string[] {
  return state.seats.filter((s) => !s.eliminated && s.id !== targetSeatId && seatDistance(state, targetSeatId, s.id, registry) === 1).map((s) => s.id);
}

const livingAboveZero = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated && s.combinedHp > 0);
const isLiving = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);

// Whether the wearer may be asked now: still in the game, still wearing this glaive, with a hand card,
// and the damaged seat still living above 0 HP with a neighbour to hit.
function canAsk(state: GameState, wearerId: string, glaiveId: string, targetSeatId: string, registry: Registry): boolean {
  const wearer = state.seats.find((s) => s.id === wearerId);
  const worn = !!wearer && !!state.zones.find((z) => z.id === wearer.equipped.zoneId)?.cards.some((c) => c.instanceId === glaiveId);
  return (
    isLiving(state, wearerId) && worn &&
    handOf(state, wearerId).length > 0 &&
    livingAboveZero(state, targetSeatId) &&
    neighboursOf(state, targetSeatId, registry).length > 0
  );
}

// The step's wearer, as the ability's owner.
const ownerOf = (step: CardStep): Extract<AbilityOwner, { kind: 'equipment' }> => ({ kind: 'equipment', seatId: step.userSeatId, cardInstanceId: step.card.physical[0].instanceId });

// Trident Glaive: after its wearer's Sha damages a seat that is still living, the wearer may
// discard a hand card to deal 1 damage to another seat next to that seat (themselves included).
// Other abilities on the same damage may act first, so the ask, the cards and the seats are each
// worked out when their step comes ('trident-glaive-ask', then 'trident-glaive-pick' after the discard).
export const tridentGlaiveCard = makeEquipmentCard('trident-glaive', 'Trident Glaive', 'weapon', kingdomWarsCardData('trident-glaive')?.range ?? 3, {
  abilities: {
    triggers: [
      {
        point: 'after:DamageDealtEvent',
        condition: (state, subject, owner, registry) => {
          const { damage } = subject as DamageDealtEvent;
          return (
            owner?.kind === 'equipment' && !!registry &&
            damage.cause?.card?.as === 'sha' &&
            damage.source?.kind === 'seat' && damage.source.seatId === owner.seatId &&
            damage.target.kind === 'seat' &&
            canAsk(state, owner.seatId, owner.cardInstanceId, damage.target.seatId, registry)
          );
        },
        effect: (state, subject, owner) => {
          const { damage } = subject as DamageDealtEvent;
          const glaive = ownerCard(state, owner!);
          if (!glaive || damage.target.kind !== 'seat') return [];
          return [cardStep('trident-glaive-ask', usedCardOf(glaive), owner!.seatId, { kind: 'seat', seatId: damage.target.seatId })];
        },
      },
    ],
  },
  onStep: (state, step, registry) => {
    const owner = ownerOf(step);
    const targetSeatId = step.target.seatId;
    const reason = { kind: 'ability' as const, owner, abilityId: 'trident-glaive', targetSeatId };
    if (step.step === 'trident-glaive-ask') {
      if (!canAsk(state, owner.seatId, owner.cardInstanceId, targetSeatId, registry)) return [];
      const ask: Effect = {
        kind: 'AskUseEffect',
        owner,
        abilityId: 'trident-glaive',
        targetSeatId,
        effects: [
          {
            kind: 'OpenSelectionEffect',
            selection: {
              id: `trident-glaive-discard-${owner.seatId}-${state.log.length}`,
              seatId: owner.seatId,
              reason,
              of: 'cards',
              eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId),
              min: 1,
              max: 1,
              then: { kind: 'discard', then: [{ ...step, step: 'trident-glaive-pick' }] },
              onCancel: [],
            },
          },
        ],
      };
      return [ask];
    }
    if (step.step === 'trident-glaive-pick') {
      if (!isLiving(state, owner.seatId) || !isLiving(state, targetSeatId)) return [];
      const seats = neighboursOf(state, targetSeatId, registry);
      if (seats.length === 0) return [];
      const pick: Effect = {
        kind: 'OpenChoiceEffect',
        choice: {
          id: `trident-glaive-${owner.seatId}-${state.log.length}`,
          seatId: owner.seatId,
          reason,
          verb: 'pick',
          options: seatOptions(seats, (id) => [
            {
              kind: 'DamageEffect',
              damage: {
                source: { kind: 'seat', seatId: owner.seatId },
                target: { kind: 'seat', seatId: id },
                amount: 1,
                nature: 'normal',
                cause: { cardInstanceId: owner.cardInstanceId, card: step.card },
              },
            },
          ]),
        },
      };
      return [pick];
    }
    throw new Error(`Trident Glaive has no step ${step.step}`);
  },
});
