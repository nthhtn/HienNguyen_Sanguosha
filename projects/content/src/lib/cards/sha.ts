import type { CardDefinition, Effect, GameState, Target, UsedCard } from 'engine';
import { livingSeatOrderFrom, usedCardKey } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';
import { CardStep, cardStep } from '../shared/steps';
import { WINE_FLAG } from './wine';

// What a Sha's steps carry. `extra`: damage added to a hit (Wine, Ancient
// Scimitar). `lastHandCard`: played as its user's last hand card (Sky
// Scorcher). `picked`: extra targets chosen at 'sha-use'. `needed`/`provided`:
// Shan asked for and given so far. `acted`: abilities that had their say.
export interface ShaStepData {
  extra?: number;
  lastHandCard?: boolean;
  picked?: string[];
  needed?: number;
  provided?: number;
  acted?: string[];
}

export const shaData = (step: CardStep) => (step.data ?? {}) as ShaStepData;

// The next step of the same Sha at the same target, keeping its extra damage.
export function shaStep(from: CardStep, step: string, more: ShaStepData = {}): CardStep {
  return cardStep(step, from.card, from.userSeatId, from.target, { extra: shaData(from).extra ?? 0, ...more });
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

// Sha: see the Sha-Equipment spec's steps. Played in the Play Phase it counts
// toward the limit and spends Wine at once, whatever its steps bring.
export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce): the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen: a no-op rather than a crash
    const boosted = !ctx.free && !!state.turn.flags?.[WINE_FLAG];
    const spend: Effect[] = boosted ? [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG, value: false }] : [];
    // Still in hand while play() runs: is it all that's left there?
    const hand = state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === ctx.seatId)?.cards ?? [];
    const lastHandCard = !ctx.free && hand.length > 0 && hand.every((c) => ctx.card.physical.some((p) => p.instanceId === c.instanceId));
    return [...spend, cardStep('sha-use', ctx.card, ctx.seatId, ctx.targets[0], { extra: boosted ? 1 : 0, ...(lastHandCard ? { lastHandCard: true } : {}) })];
  },
  onStep: (state, step) => {
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
        return [shaStep(step, 'sha-shan', { needed: 1, provided: 0 })];
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
