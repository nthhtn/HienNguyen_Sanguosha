import type { AbilityOwner, CardInstance, ContentRegistry, Effect, GameState, JudgmentReader, SkillTrigger } from 'engine';
import { usedCardOf } from 'engine';
import { colourFor } from '../../shared/suits';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { shaIgnoresArmor } from '../../shared/armor';
import { ownerCard } from '../../shared/abilities';

interface ShanData {
  needed?: number;
  provided?: number;
}

// Eight Trigrams' ability, for the armour and for skills that grant it (Eight
// Arrays): whenever its owner needs a Shan ('sha-shan' or 'hail-shan') and
// `applies`, it may judge first (read by `reader`; none left to read with: the
// Shan is asked for as normal). Red counts as one Shan; on black the Shan is
// asked for as normal. At most one Shan per step. Black Pommel turns it off
// against a Sha.
export function eightTrigramsTrigger(
  abilityId: string,
  reader: (state: GameState, owner: AbilityOwner) => JudgmentReader | null,
  applies: (state: GameState, owner: AbilityOwner, registry: ContentRegistry) => boolean = () => true
): SkillTrigger {
  return atStep(['sha-shan', 'hail-shan'], {
    condition: (state, step, owner, registry) => {
      const { needed = 1, provided = 0 } = (step.data ?? {}) as ShanData;
      return (
        step.target.seatId === owner.seatId && provided < needed && !(step.step === 'sha-shan' && shaIgnoresArmor(state, step, registry)) && applies(state, owner, registry)
      );
    },
    effect: (state, step, owner) => {
      const judgeWith = reader(state, owner);
      if (!judgeWith) return [actedOn(step, owner)];
      const judge: Effect = { kind: 'JudgeEffect', seatId: owner.seatId, reader: judgeWith, data: { step: actedOn(step, owner) }, otherwise: [actedOn(step, owner)] };
      return [askAtStep(owner, abilityId, step, [judge])];
    },
  });
}

// What its judgment gives: one more Shan on red, nothing on black (as the owner counts suits).
export function eightTrigramsOutcome(state: GameState, ownerSeatId: string, judged: CardInstance, registry: ContentRegistry): 'shan' | 'none' {
  return colourFor(state, ownerSeatId, judged, registry) === 'red' ? 'shan' : 'none';
}

// Reading its judgment: the judged card goes to the discard pile first
// (`done`), so it doesn't lie in processing while the Shan window waits. Then
// the step goes on: with one more Shan provided on red.
export function eightTrigramsJudged(
  state: GameState,
  owner: AbilityOwner,
  abilityId: string,
  judged: CardInstance,
  data: Record<string, unknown> | undefined,
  done: Effect,
  registry: ContentRegistry
): Effect[] {
  const step = data?.['step'] as CardStep;
  if (eightTrigramsOutcome(state, owner.seatId, judged, registry) === 'none') return [done, step];
  const { provided = 0 } = (step.data ?? {}) as ShanData;
  return [done, { kind: 'AbilityUsedEffect', owner, abilityId, outcome: 'counts-as-shan' }, { ...step, data: { ...step.data, provided: provided + 1 } }];
}

// Eight Trigrams: the ability above, judged with the worn card.
export const eightTrigramsCard = makeEquipmentCard('eight-trigrams', 'Eight Trigrams', 'armor', undefined, {
  abilities: {
    triggers: [
      eightTrigramsTrigger('eight-trigrams', (state, owner) => {
        const worn = ownerCard(state, owner);
        return worn ? { kind: 'card', card: usedCardOf(worn) } : null;
      }),
    ],
  },
  onJudged: (state, { judged, data, seatId, tool, done }, registry) =>
    eightTrigramsJudged(state, { kind: 'equipment', seatId, cardInstanceId: tool.physical[0].instanceId }, 'eight-trigrams', judged, data, done, registry),
});
