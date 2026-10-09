import type { CardInstance, Effect, GameState, GeneralOwner } from 'engine';
import { handOf } from './queries';
import { discardMoves, isLiving, selectionOf, skillStep, type SkillStep, used } from './skills';

// Competing (stage 9 spec): the user picks a hand card face down, then the
// target does; both are shown and discarded; the user wins only with a
// strictly higher rank (A is 1, K is 13), so a tie loses. Run as the owning
// skill's steps: its onStep hands every step to competeStep first, and gets
// `resultStep` with { ...data, target, won, userCard, targetCard }.
export function competeStart(state: GameState, owner: GeneralOwner, targetSeatId: string, resultStep: string, data: Record<string, unknown> = {}): Effect[] {
  return [
    selectionOf(state, owner, {
      of: 'cards',
      eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId),
      min: 1,
      max: 1,
      targetSeatId,
      then: { kind: 'skill-step', step: skillStep(owner, 'compete-user', { ...data, target: targetSeatId, resultStep }) },
    }),
  ];
}

const findCard = (state: GameState, id: unknown): CardInstance | undefined => state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id);
const firstPicked = (step: SkillStep) => ((step.data?.['picked'] as string[] | undefined) ?? [])[0];
// The step's data without the selection's `picked`.
const carried = (step: SkillStep): Record<string, unknown> => {
  const { picked: _picked, ...rest } = step.data ?? {};
  return rest;
};

// The competing steps; null for any other step (the skill handles it).
export function competeStep(state: GameState, step: SkillStep): Effect[] | null {
  const { owner } = step;
  const target = step.data?.['target'] as string;
  if (step.step === 'compete-user') {
    if (!isLiving(state, target) || handOf(state, target).length === 0) return [];
    return [
      selectionOf(state, owner, {
        seatId: target,
        targetSeatId: target,
        of: 'cards',
        eligibleIds: handOf(state, target).map((c) => c.instanceId),
        min: 1,
        max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'compete-target', { ...carried(step), userCard: firstPicked(step) }) },
      }),
    ];
  }
  if (step.step === 'compete-target') {
    const userCard = findCard(state, step.data?.['userCard']);
    const targetCard = findCard(state, firstPicked(step));
    if (!userCard || !targetCard) return [];
    const won = userCard.rank > targetCard.rank;
    return [
      { kind: 'ShowCardEffect', seatId: owner.seatId, cardInstanceId: userCard.instanceId, abilityId: owner.skillId },
      { kind: 'ShowCardEffect', seatId: target, cardInstanceId: targetCard.instanceId, abilityId: owner.skillId },
      ...discardMoves(state, [userCard.instanceId, targetCard.instanceId]),
      used(owner, won ? 'compete-won' : 'compete-lost', target),
      skillStep(owner, step.data?.['resultStep'] as string, { ...carried(step), won, userCard: userCard.instanceId, targetCard: targetCard.instanceId }),
    ];
  }
  return null;
}
