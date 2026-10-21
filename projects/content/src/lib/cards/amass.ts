import type { CardDefinition, GameState } from 'engine';
import { toolOnTargets } from '../shared/tools';
import { cardStep } from '../shared/steps';
import { sameKingdomSeatIds } from '../shared/kingdom';
import { handOf } from '../shared/queries';

// A seat's hand and worn cards: what Amass lets it discard.
function discardable(state: GameState, seatId: string): string[] {
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = (seat && state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards) ?? [];
  return [...handOf(state, seatId), ...worn].map((c) => c.instanceId);
}

// Amass: the user and every other living seat of its Kingdom (the user alone
// while it has no exposed General), fixed when it is used. In turn order from
// the user, each target draws 2 then discards 2 (hand or equipment) before the
// next begins; each target has its own Wuxie check, and a cancelled or dead
// target is skipped.
export const amassCard: CardDefinition = {
  id: 'amass',
  name: 'Amass',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) =>
    ctx.respondingTo ? [] : toolOnTargets(ctx.card, ctx.seatId, sameKingdomSeatIds(state, ctx.seatId).map((seatId) => ({ kind: 'seat' as const, seatId }))),
  onTarget: (_state, { tool, userSeatId, target }) => [
    { kind: 'DrawCardsEffect', seatId: target.seatId, count: 2 },
    cardStep('amass-discard', tool, userSeatId, target),
  ],
  onStep: (state, step) => {
    const seatId = step.target.seatId;
    const eligibleIds = discardable(state, seatId);
    if (step.step !== 'amass-discard' || eligibleIds.length === 0) return [];
    const count = Math.min(2, eligibleIds.length);
    return [
      {
        kind: 'OpenSelectionEffect',
        selection: {
          id: `amass-${seatId}-${state.log.length}`,
          seatId,
          reason: { kind: 'card-effect', card: step.card, userSeatId: step.userSeatId },
          of: 'cards',
          eligibleIds,
          min: count,
          max: count,
          then: { kind: 'discard' },
        },
      },
    ];
  },
};
