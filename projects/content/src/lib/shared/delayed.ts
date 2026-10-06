import type { CardDefinition, CardInstance, Effect, GameState, Phase, PhaseChangedEvent, SkillTrigger } from 'engine';
import { judgmentZoneOf, skipFlagOf, usedCardOf } from 'engine';
import { otherLivingSeatTargets, seatDistance } from './queries';
import { COUNTER_CARD_IDS } from './tools';

// Whether `seatId`'s judgment area already holds a `definitionId`.
export function holdsDelayed(state: GameState, seatId: string, definitionId: string): boolean {
  return !!judgmentZoneOf(state, seatId)?.cards.some((c) => c.definitionId === definitionId);
}

// The move that puts a delayed Tool face up into `seatId`'s judgment area.
export function placeInJudgmentArea(state: GameState, cardInstanceId: string, seatId: string): Effect[] {
  const zone = judgmentZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no judgment area`);
  return [{ kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id }];
}

// A delayed Tool's rule once its Wuxie check has passed: judge its seat.
export const judgeTarget: NonNullable<CardDefinition['onTarget']> = (_state, { tool, target }) =>
  target.kind === 'seat' ? [{ kind: 'JudgeEffect', seatId: target.seatId, tool }] : [];

interface SkipPhaseToolSpec {
  id: string;
  name: string;
  // The phase a landed judgment skips, and the suit that spares it.
  skips: Phase;
  spares: CardInstance['suit'];
  // Reach (horses counted); absent = any distance.
  maxDistance?: number;
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
          (maxDistance === undefined || seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance)
      ),
    play: (state, ctx) => {
      const [target] = ctx.targets;
      return ctx.respondingTo || target?.kind !== 'seat' ? [] : placeInJudgmentArea(state, ctx.cardInstanceId, target.seatId);
    },
    onTarget: judgeTarget,
    onJudged: (_state, { judged }) => (judged.suit === spares ? [] : [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf(skips) }]),
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
    const lastInFirstOut = [...judgmentZoneOf(state, seatId)!.cards].reverse();
    return lastInFirstOut.flatMap((card): Effect[] => {
      const tool = usedCardOf(card);
      return [
        { kind: 'ToolOnTargetEffect', tool, userSeatId: seatId, target: { kind: 'seat', seatId }, counterCardIds: COUNTER_CARD_IDS },
        { kind: 'DelayedCleanupEffect', tool, ownerSeatId: seatId },
      ];
    });
  },
};
