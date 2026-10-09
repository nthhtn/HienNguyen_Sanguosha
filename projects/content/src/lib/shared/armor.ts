import type { ContentRegistry, GameState, SkillTrigger } from 'engine';
import { activeAbilities } from './abilities';
import { CardStep, atStep } from './steps';

// Whether a Sha's step has its target's armour turned off: the Sha's user has
// an ability that ignores armour (Black Pommel). Armour steps run from step 2
// to step 5.
export function shaIgnoresArmor(state: GameState, step: CardStep, registry: ContentRegistry): boolean {
  return step.card.as === 'sha' && activeAbilities(state, step.userSeatId, registry).some((a) => a.modifiers?.ignoresArmor);
}

// Armour that stops a Sha at step 2 when `applies` (Black Shield, Wood Armor):
// the step becomes a logged "no effect" (naming the Sha's user), and the Sha
// goes no further at this target.
export function stopsSha(abilityId: string, applies: (step: CardStep) => boolean): SkillTrigger {
  return atStep(['sha-armor'], {
    condition: (state, step, owner, registry) => step.target.seatId === owner.seatId && applies(step) && !shaIgnoresArmor(state, step, registry),
    effect: (_state, step, owner) => [{ kind: 'AbilityUsedEffect', owner, abilityId, outcome: 'no-effect', targetSeatId: step.userSeatId }],
  });
}
