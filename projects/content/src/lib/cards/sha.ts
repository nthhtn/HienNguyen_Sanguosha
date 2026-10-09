import type { CardDefinition, Effect, GameState, Target, UsedCard } from 'engine';
import { livingSeatOrderFrom, usedCardKey } from 'engine';
import { handOf, SHA_FLAGS, shaFlag, shaLimit } from '../shared/queries';
import { shaTargetIds } from '../shared/shaRules';
import { activeAbilities } from '../shared/abilities';
import { CardStep, cardStep } from '../shared/steps';
import { answersNeededAgainst } from '../shared/abilities';
import { WINE_FLAG } from './wine';

// What a Sha's steps carry. `extra`: damage added to a hit (Wine, Ancient
// Scimitar). `picked`: the other targets chosen with the first. `needed`/`provided`:
// Shan asked for and given so far. `unblockable`: no Shan is asked for (Iron
// Cavalry). `acted`: abilities that had their say.
export interface ShaStepData {
  extra?: number;
  picked?: string[];
  needed?: number;
  provided?: number;
  unblockable?: boolean;
  acted?: string[];
}

export const shaData = (step: CardStep) => (step.data ?? {}) as ShaStepData;

// The next step of the same Sha at the same target, keeping its extra damage
// and whether it can be dodged.
export function shaStep(from: CardStep, step: string, more: ShaStepData = {}): CardStep {
  const { extra = 0, unblockable } = shaData(from);
  return cardStep(step, from.card, from.userSeatId, from.target, { extra, ...(unblockable ? { unblockable } : {}), ...more });
}

// A Sha's steps from step 1 at each target, in seat order from its user.
export function shaAt(state: GameState, card: UsedCard, userSeatId: string, targets: Target[], extra = 0): Effect[] {
  const order = livingSeatOrderFrom(state, userSeatId);
  return [...targets]
    .sort((a, b) => order.indexOf(a.seatId) - order.indexOf(b.seatId))
    .map((target) => cardStep('sha-targeted', card, userSeatId, target, { extra }));
}

function damageOf(step: CardStep): Effect {
  const first = step.card.physical[0]?.instanceId;
  return {
    kind: 'DamageEffect',
    damage: {
      source: { kind: 'seat', seatId: step.userSeatId },
      target: step.target,
      amount: 1 + (shaData(step).extra ?? 0),
      nature: 'normal',
      cause: { ...(first ? { cardInstanceId: first } : {}), card: step.card },
    },
  };
}

// Step 3: the target plays a Shan (one more provided), or the Sha hits.
function shanWindow(step: CardStep): Effect {
  const { needed = 1, provided = 0 } = shaData(step);
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${usedCardKey(step.card)}-${step.target.seatId}-${provided}`,
      respondingSeatId: step.target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      reason: { kind: 'card-effect', card: step.card, userSeatId: step.userSeatId },
      context: { effect: shaStep(step, 'sha-hit') },
      onAnswer: [shaStep(step, 'sha-shan', { needed, provided: provided + 1 })],
      outcome: damageOf(step),
    },
  };
}

const isLiving = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);

// Whether `seatId` may play a Sha now: under its limit, and not barred this
// turn (a lost Heaven's Justice).
const shaPlayable = (state: GameState, seatId: string, registry: Parameters<typeof shaLimit>[2]) =>
  !shaFlag(state, seatId, SHA_FLAGS.none) && (state.turn.cardPlays?.['sha'] ?? 0) < shaLimit(state, seatId, registry);

// Sha: see the Sha-Equipment spec's steps. Played in the Play Phase it counts
// toward the limit and spends Wine at once, whatever its steps bring.
export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if (!shaPlayable(state, ctx.seatId, registry)) return [];
    return shaTargetIds(state, ctx.seatId, registry).map((seatId) => [{ kind: 'seat' as const, seatId }]);
  },
  // Several targets at once (stage 9 spec, "Several equal targets"): Sky
  // Scorcher's +2 when it is the user's last hand card (for a conversion: hand
  // cards alone, and all of them), +1 after a won Heaven's Justice. Null when
  // only one target is allowed.
  targetPick: (state, ctx, registry) => {
    if (!shaPlayable(state, ctx.seatId, registry)) return null;
    const hand = handOf(state, ctx.seatId);
    const lastCard = ctx.via ? ctx.via.fromHandOnly && hand.length === ctx.via.cards : hand.length === 1 && hand[0].instanceId === ctx.cardInstanceId;
    const scorcher = lastCard ? Math.max(0, ...activeAbilities(state, ctx.seatId, registry).map((a) => a.modifiers?.extraShaTargetsWhenLastCard ?? 0)) : 0;
    const extra = shaFlag(state, ctx.seatId, SHA_FLAGS.extraTarget) ? 1 : 0;
    const eligibleIds = shaTargetIds(state, ctx.seatId, registry);
    const max = Math.min(1 + scorcher + extra, eligibleIds.length);
    return max > 1 ? { eligibleIds, min: 1, max } : null;
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce): the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen: a no-op rather than a crash
    const boosted = !ctx.free && !!state.turn.flags?.[WINE_FLAG];
    const spend: Effect[] = boosted ? [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG, value: false }] : [];
    const picked = ctx.targets.slice(1).map((t) => t.seatId);
    return [...spend, cardStep('sha-use', ctx.card, ctx.seatId, ctx.targets[0], { extra: boosted ? 1 : 0, ...(picked.length > 0 ? { picked } : {}) })];
  },
  onStep: (state, step, registry) => {
    const data = shaData(step);
    if (step.step === 'sha-use') {
      const extraTargets: Target[] = (data.picked ?? []).map((seatId) => ({ kind: 'seat', seatId }));
      return shaAt(state, step.card, step.userSeatId, [step.target, ...extraTargets], data.extra ?? 0);
    }
    // A target gone before its turn comes is simply skipped.
    if (!isLiving(state, step.target.seatId)) return [];
    switch (step.step) {
      case 'sha-targeted':
        return [shaStep(step, 'sha-armor')];
      case 'sha-armor':
        // An unblockable Sha hits; otherwise the target owes 1 Shan (2 against Matchless).
        return shaData(step).unblockable
          ? [shaStep(step, 'sha-hit')]
          : [shaStep(step, 'sha-shan', { needed: answersNeededAgainst(state, step.userSeatId, registry), provided: 0 })];
      case 'sha-shan':
        return (data.provided ?? 0) >= (data.needed ?? 1) ? [shaStep(step, 'sha-dodged')] : [shanWindow(step)];
      case 'sha-dodged':
        return [];
      case 'sha-hit':
        return [shaStep(step, 'sha-damage')];
      case 'sha-damage':
        return [damageOf(step), shaStep(step, 'sha-after-damage')];
      case 'sha-after-damage':
        return [];
      default:
        throw new Error(`Sha has no step ${step.step}`);
    }
  },
};
