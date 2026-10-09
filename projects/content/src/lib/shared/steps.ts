import type { AbilityOwner, ContentRegistry, Effect, GameState, SkillTrigger, Target, UsedCard } from 'engine';

export type CardStep = Extract<Effect, { kind: 'CardStepEffect' }>;

export function cardStep(step: string, card: UsedCard, userSeatId: string, target: Target, data: Record<string, unknown> = {}): CardStep {
  return { kind: 'CardStepEffect', step, card, userSeatId, target, data };
}

// An ability's key in an `acted` list: the worn card, or the seat/slot/skill.
export const abilityKey = (owner: AbilityOwner) => (owner.kind === 'equipment' ? owner.cardInstanceId : `${owner.seatId}:${owner.slot}:${owner.skillId}`);
const actedKeys = (step: CardStep) => (step.data?.['acted'] as string[] | undefined) ?? [];

// Whether `owner`'s ability has already had its say at this step.
export function hasActed(step: CardStep, owner: AbilityOwner): boolean {
  return actedKeys(step).includes(abilityKey(owner));
}

// The step, marked so `owner`'s ability doesn't act on it again (an ask's
// Don't sends it back through its before-triggers).
export function actedOn(step: CardStep, owner: AbilityOwner): CardStep {
  return { ...step, data: { ...step.data, acted: [...actedKeys(step), abilityKey(owner)] } };
}

// An optional ability at a step: ask its owner. Use queues `effects`; Don't
// lets the step go on. The ask names the step's target unless `targetSeatId`
// says otherwise (null: no target).
export function askAtStep(owner: AbilityOwner, abilityId: string, step: CardStep, effects: Effect[], targetSeatId: string | null = step.target.seatId): Effect {
  return { kind: 'AskUseEffect', owner, abilityId, effects, otherwise: [actedOn(step, owner)], ...(targetSeatId ? { targetSeatId } : {}) };
}

export interface StepRule {
  condition?(state: GameState, step: CardStep, owner: AbilityOwner, registry: ContentRegistry): boolean;
  effect(state: GameState, step: CardStep, owner: AbilityOwner, registry: ContentRegistry): Effect[];
}

// A worn card's (or skill's) rule at the named steps: a before-trigger on
// CardStepEffect that acts at most once per step. Its effect replaces the step:
// a rewrite (return the step changed, marked with actedOn), a stop (return
// something else, or nothing), or an ask (askAtStep). It never acts on an
// eliminated target.
export function atStep(steps: string[], rule: StepRule): SkillTrigger {
  return {
    point: 'before:CardStepEffect',
    condition: (state, subject, owner, registry) => {
      const step = subject as CardStep;
      const targetLiving = state.seats.some((s) => s.id === step.target.seatId && !s.eliminated);
      return !!owner && !!registry && steps.includes(step.step) && targetLiving && !hasActed(step, owner) && (rule.condition?.(state, step, owner, registry) ?? true);
    },
    effect: (state, subject, owner, registry) => rule.effect(state, subject as CardStep, owner!, registry!),
  };
}
