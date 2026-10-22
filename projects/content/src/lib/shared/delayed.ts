import type { CardDefinition, CardInstance, ContentRegistry, Effect, GameState, Phase, PhaseChangedEvent, SkillTrigger } from 'engine';
import { cardCountsAs, judgmentZoneOf, skipFlagOf, usedCardFrom, usedCardOf } from 'engine';
import { rangeBonusFor, toolsIgnoreDistance, untargetableBy } from './abilities';
import { suitOf } from './suits';
import { otherLivingSeatTargets, seatDistance } from './queries';
import { COUNTER_CARD_IDS, playColour } from './tools';
import { DELAYED_PLACE_STEP } from './cancel';

// Whether `seatId`'s judgment area already holds a `definitionId` (or a card placed as one).
export function holdsDelayed(state: GameState, seatId: string, definitionId: string): boolean {
  const zone = judgmentZoneOf(state, seatId);
  return !!zone?.cards.some((c) => cardCountsAs(zone, c) === definitionId);
}

// The move that puts a delayed Tool face up into `seatId`'s judgment area, as
// `countsAs` when it is another card used as that Tool (Country Scene).
export function placeInJudgmentArea(state: GameState, cardInstanceId: string, seatId: string, countsAs?: string): Effect[] {
  const zone = judgmentZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no judgment area`);
  return [{ kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id, ...(countsAs ? { countsAs } : {}) }];
}

// A delayed Tool's rule once its Wuxie check has passed: judge its seat.
// Its turn can come after the Tool left the judgment area or its holder was
// eliminated, so that is re-checked here; the cleanup is queued separately and
// still runs.
export const judgeTarget: NonNullable<CardDefinition['onTarget']> = (state, { tool, target }) => {
  if (target.kind !== 'seat') return [];
  const holder = state.seats.find((s) => s.id === target.seatId);
  const held = judgmentZoneOf(state, target.seatId)?.cards.some((c) => tool.physical.some((p) => p.instanceId === c.instanceId));
  return holder && !holder.eliminated && held ? [{ kind: 'JudgeEffect', seatId: target.seatId, reader: { kind: 'card', card: tool } }] : [];
};

interface SkipPhaseToolSpec {
  id: string;
  name: string;
  // The phase a landed judgment skips, and the suit that spares it.
  skips: Phase;
  spares: CardInstance['suit'];
  // Reach (horses counted); absent = any distance.
  maxDistance?: number;
}

// What a judged card does to a skip-phase Tool: anything but a `spares` card (as the judged
// seat counts suits) skips the phase.
export function skipPhaseOutcome(state: GameState, seatId: string, judged: CardInstance, spares: CardInstance['suit'], registry: ContentRegistry): 'skip' | 'spared' {
  return suitOf(state, seatId, judged, registry) === spares ? 'spared' : 'skip';
}

// Capture and Starvation: placed on another living seat (within `maxDistance`
// when set) that doesn't already hold one. Judged in that seat's Judgment
// Phase: anything but a `spares` card skips `skips` this turn. Then discarded
// (the engine's default cleanup), judged or cancelled.
export function skipPhaseTool({ id, name, skips, spares, maxDistance }: SkipPhaseToolSpec): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    delayed: true,
    legalPlayTargets: (state, ctx, registry) =>
      otherLivingSeatTargets(state, ctx.seatId).filter(
        ([target]) =>
          target.kind === 'seat' &&
          !holdsDelayed(state, target.seatId, id) &&
          !untargetableBy(state, target.seatId, id, registry, playColour(state, ctx, registry)) &&
          (maxDistance === undefined ||
            toolsIgnoreDistance(state, ctx.seatId, registry) ||
            seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance + rangeBonusFor(state, ctx.seatId, id, registry))
      ),
    // Placed at its own step, where a skill may cancel it for the target (shared/cancel.ts).
    play: (_state, ctx) => {
      const [target] = ctx.targets;
      return ctx.respondingTo || target?.kind !== 'seat' ? [] : [{ kind: 'CardStepEffect', step: DELAYED_PLACE_STEP, card: ctx.card, userSeatId: ctx.seatId, target }];
    },
    onStep: (state, step) => {
      if (step.step !== DELAYED_PLACE_STEP) throw new Error(`${id} has no step ${step.step}`);
      const card = step.card.physical[0];
      return card && step.target.kind === 'seat' ? placeInJudgmentArea(state, card.instanceId, step.target.seatId, step.card.as) : [];
    },
    onTarget: judgeTarget,
    onJudged: (state, { judged, seatId }, registry) => (skipPhaseOutcome(state, seatId, judged, spares, registry) === 'spared' ? [] : [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf(skips) }]),
  };
}

// Kingdom War's Judgment Phase: the turn owner's delayed Tools are judged one
// at a time, last in, first out. Each gets the usual Wuxie check (asked from the
// judged seat, which stands in as the Tool's user), which guards only the
// judgment. Its cleanup always runs.
export const judgmentPhaseTrigger: SkillTrigger = {
  point: 'after:PhaseChangedEvent',
  condition: (state, subject) => {
    const event = subject as PhaseChangedEvent;
    return event.phase === 'Judgment' && (judgmentZoneOf(state, event.seatId)?.cards.length ?? 0) > 0;
  },
  effect: (state, subject) => {
    const { seatId } = subject as PhaseChangedEvent;
    const zone = judgmentZoneOf(state, seatId)!;
    const lastInFirstOut = [...zone.cards].reverse();
    return lastInFirstOut.flatMap((card): Effect[] => {
      // A card placed as another (Country Scene's Capture) is judged as that.
      const as = cardCountsAs(zone, card);
      const tool = as === card.definitionId ? usedCardOf(card) : usedCardFrom([card], as);
      return [
        { kind: 'ToolOnTargetEffect', tool, userSeatId: seatId, target: { kind: 'seat', seatId }, counterCardIds: COUNTER_CARD_IDS },
        { kind: 'DelayedCleanupEffect', tool, ownerSeatId: seatId },
      ];
    });
  },
};
