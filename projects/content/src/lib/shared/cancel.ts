import type { ContentRegistry, Effect, GameState, GeneralOwner, SkillTrigger, UsedCard } from 'engine';
import { atStep, CardStep } from './steps';
import { discardMoves, on, used } from './skills';

type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// Whether the owner's skill cancels `card`, used by `userSeatId`, for the owner's seat.
export type CancelsCard = (state: GameState, card: UsedCard, userSeatId: string, ownerSeatId: string, registry: ContentRegistry) => boolean;

// The step a delayed Tool is placed at (shared/delayed.ts): before it lies in the target's judgment area.
export const DELAYED_PLACE_STEP = 'delayed-place';
// The step a Sha is aimed at a target (cards/sha.ts): before any ability reacts to it targeting that seat.
export const SHA_AIMED_STEP = 'sha-aimed';

// The log line of a cancelled card: the owner's skill made the user's card have no effect.
const cancelled = (owner: GeneralOwner, card: UsedCard, userSeatId: string): Effect => used(owner, 'no-effect', userSeatId, card.as);

// A compulsory skill that cancels cards aimed at its owner's seat (Alternate Empty City, Humility and
// Behind the Curtain): the seat may be chosen, the card is used (and counts toward any limit), but it has
// no effect on that seat and is wasted. A Sha stops where it is aimed, before abilities react to the
// target; a Tool before its Wuxie check; a delayed Tool before it is placed, and goes to the discard pile.
export function cancelsCardsOnOwner(cancels: CancelsCard): SkillTrigger[] {
  const aimedAtOwner = (state: GameState, card: UsedCard, userSeatId: string, targetSeatId: string, owner: GeneralOwner, registry: ContentRegistry) =>
    targetSeatId === owner.seatId && userSeatId !== owner.seatId && cancels(state, card, userSeatId, owner.seatId, registry);
  const atOwnerStep = (step: string, effect: (state: GameState, step: CardStep, owner: GeneralOwner) => Effect[]) =>
    atStep([step], {
      condition: (state, s, owner, registry) => owner.kind === 'general' && aimedAtOwner(state, s.card, s.userSeatId, s.target.seatId, owner, registry),
      effect: (state, s, owner) => effect(state, s, owner as GeneralOwner),
    });
  return [
    atOwnerStep(SHA_AIMED_STEP, (_state, step, owner) => [cancelled(owner, step.card, step.userSeatId)]),
    atOwnerStep(DELAYED_PLACE_STEP, (state, step, owner) => [
      cancelled(owner, step.card, step.userSeatId),
      ...discardMoves(state, step.card.physical.map((c) => c.instanceId)),
    ]),
    on<ToolOnTarget>('before:ToolOnTargetEffect', {
      condition: (state, effect, owner, registry) => effect.target.kind === 'seat' && aimedAtOwner(state, effect.tool, effect.userSeatId, effect.target.seatId, owner, registry),
      effect: (_state, effect, owner) => [cancelled(owner, effect.tool, effect.userSeatId)],
    }),
  ];
}
