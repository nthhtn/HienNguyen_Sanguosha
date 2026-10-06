import type { Effect } from 'engine';
import { colourOf, requireZoneOfKind, usedCardOf } from 'engine';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { shaIgnoresArmor } from '../../shared/armor';
import { ownerCard } from '../../shared/abilities';

interface ShanData {
  needed?: number;
  provided?: number;
}

// Eight Trigrams: whenever its wearer needs a Shan ('sha-shan' or
// 'hail-shan'), it may judge first. Red counts as one Shan; on black the Shan
// is asked for as normal. It provides at most one Shan per step. Black Pommel
// turns it off against a Sha.
export const eightTrigramsCard = makeEquipmentCard('eight-trigrams', 'Eight Trigrams', 'armor', undefined, {
  abilities: {
    triggers: [
      atStep(['sha-shan', 'hail-shan'], {
        condition: (state, step, owner, registry) => {
          const { needed = 1, provided = 0 } = (step.data ?? {}) as ShanData;
          return step.target.seatId === owner.seatId && provided < needed && !(step.step === 'sha-shan' && shaIgnoresArmor(state, step, registry));
        },
        effect: (state, step, owner) => {
          const worn = ownerCard(state, owner);
          if (!worn) return [actedOn(step, owner)];
          const judge: Effect = { kind: 'JudgeEffect', seatId: owner.seatId, tool: usedCardOf(worn), data: { step: actedOn(step, owner) } };
          return [askAtStep(owner, 'eight-trigrams', step, [judge])];
        },
      }),
    ],
  },
  // The judged card goes to the discard pile first, so it doesn't lie in
  // processing while the Shan window waits. Then the step goes on: with one
  // more Shan provided on red.
  onJudged: (state, { judged, data, seatId, tool }) => {
    const step = data?.['step'] as CardStep;
    const done: Effect = {
      kind: 'MoveCardEffect',
      cardInstanceId: judged.instanceId,
      toZoneId: requireZoneOfKind(state.zones, 'discardPile').id,
      onlyFrom: requireZoneOfKind(state.zones, 'processing').id,
    };
    if (colourOf(judged) === 'black') return [done, step];
    const { provided = 0 } = (step.data ?? {}) as ShanData;
    const owner = { kind: 'equipment' as const, seatId, cardInstanceId: tool.physical[0].instanceId };
    return [
      done,
      { kind: 'AbilityUsedEffect', owner, abilityId: 'eight-trigrams', outcome: 'counts-as-shan' },
      { ...step, data: { ...step.data, provided: provided + 1 } },
    ];
  },
});
