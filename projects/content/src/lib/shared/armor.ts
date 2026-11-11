import type { ContentRegistry, GameState, SkillTrigger, UsedCard } from 'engine';
import { activeAbilities } from './abilities';
import { CardStep, atStep } from './steps';

// Whether a Sha's step has its target's armour turned off: the Sha's user has
// an ability that ignores armour (Black Pommel). Armour steps run from step 2
// to step 5.
export function shaIgnoresArmor(state: GameState, step: CardStep, registry: ContentRegistry): boolean {
  return cardIgnoresArmor(state, step.card, step.userSeatId, registry);
}

const cardIgnoresArmor = (state: GameState, card: UsedCard, userSeatId: string, registry: ContentRegistry) =>
  card.as === 'sha' && activeAbilities(state, userSeatId, registry).some((a) => a.modifiers?.ignoresArmor);

// Armour that stops a Sha at step 2 when `applies` (Black Shield, Wood Armor):
// the step becomes a logged "no effect" (naming the Sha's user), and the Sha
// goes no further at this target.
export function stopsSha(abilityId: string, applies: (card: UsedCard) => boolean): SkillTrigger {
  const trigger = atStep(['sha-armor'], {
    condition: (state, step, owner, registry) => step.target.seatId === owner.seatId && applies(step.card) && !shaIgnoresArmor(state, step, registry),
    effect: (_state, step, owner) => [{ kind: 'AbilityUsedEffect', owner, abilityId, outcome: 'no-effect', targetSeatId: step.userSeatId }],
  });
  // Declared for bots (rule A2): the same test as the condition above.
  return {
    ...trigger,
    stops: (state, use, ownerSeatId, registry) =>
      use.card.as === 'sha' && use.targetSeatId === ownerSeatId && applies(use.card) && !cardIgnoresArmor(state, use.card, use.userSeatId, registry),
  };
}
