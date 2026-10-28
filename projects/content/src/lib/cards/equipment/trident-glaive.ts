import type { Effect, GameState, UsedCard } from 'engine';
import { usedCardOf } from 'engine';
import type { DamageDealtEvent } from 'engine';
import { kingdomWarsCardData } from '../../kingdomWarsCards';
import { makeEquipmentCard } from './index';
import { ownerCard } from '../../shared/abilities';
import { handOf, seatDistance } from '../../shared/queries';
import { seatOptions } from '../../shared/skills';

// The living seats Trident Glaive may hit: next to the damaged seat (ordinary distance 1),
// never that seat itself. Its wearer counts when they sit there.
function neighboursOf(state: GameState, targetSeatId: string, registry: Parameters<typeof seatDistance>[3]): string[] {
  return state.seats.filter((s) => !s.eliminated && s.id !== targetSeatId && seatDistance(state, targetSeatId, s.id, registry) === 1).map((s) => s.id);
}

// Trident Glaive: after its wearer's Sha damages a seat that is still living, the wearer may
// discard a hand card to deal 1 damage to another seat next to that seat (themselves included).
export const tridentGlaiveCard = makeEquipmentCard('trident-glaive', 'Trident Glaive', 'weapon', kingdomWarsCardData('trident-glaive')?.range ?? 3, {
  abilities: {
    triggers: [
      {
        point: 'after:DamageDealtEvent',
        condition: (state, subject, owner, registry) => {
          const { damage } = subject as DamageDealtEvent;
          return (
            !!owner && !!registry &&
            damage.cause?.card?.as === 'sha' &&
            damage.source?.kind === 'seat' && damage.source.seatId === owner.seatId &&
            damage.target.kind === 'seat' &&
            state.seats.some((s) => s.id === owner.seatId && !s.eliminated) &&
            handOf(state, owner.seatId).length > 0 &&
            neighboursOf(state, damage.target.seatId, registry).length > 0 &&
            state.seats.some((s) => s.id === (damage.target as { seatId: string }).seatId && !s.eliminated && s.combinedHp > 0)
          );
        },
        effect: (state, subject, owner, registry) => {
          const { damage } = subject as DamageDealtEvent;
          const targetSeatId = (damage.target as { seatId: string }).seatId;
          const glaive = ownerCard(state, owner!);
          if (!glaive) return [];
          const used: UsedCard = usedCardOf(glaive);
          const pick = (): Effect[] => [
            {
              kind: 'OpenChoiceEffect',
              choice: {
                id: `trident-glaive-${owner!.seatId}-${state.log.length}`,
                seatId: owner!.seatId,
                reason: { kind: 'ability', owner: owner!, abilityId: 'trident-glaive', targetSeatId },
                verb: 'pick',
                options: seatOptions(neighboursOf(state, targetSeatId, registry!), (id) => [
                  {
                    kind: 'DamageEffect',
                    damage: {
                      source: { kind: 'seat', seatId: owner!.seatId },
                      target: { kind: 'seat', seatId: id },
                      amount: 1,
                      nature: 'normal',
                      cause: { cardInstanceId: glaive.instanceId, card: used },
                    },
                  },
                ]),
              },
            },
          ];
          return [
            {
              kind: 'AskUseEffect',
              owner: owner!,
              abilityId: 'trident-glaive',
              targetSeatId,
              effects: [
                {
                  kind: 'OpenSelectionEffect',
                  selection: {
                    id: `trident-glaive-discard-${owner!.seatId}-${state.log.length}`,
                    seatId: owner!.seatId,
                    reason: { kind: 'ability', owner: owner!, abilityId: 'trident-glaive', targetSeatId },
                    of: 'cards',
                    eligibleIds: handOf(state, owner!.seatId).map((c) => c.instanceId),
                    min: 1,
                    max: 1,
                    then: { kind: 'discard', then: pick() },
                    onCancel: [],
                  },
                },
              ],
            },
          ];
        },
      },
    ],
  },
});
