import type { CardDefinition, Effect } from 'engine';
import { judgmentZoneOf, livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { holdsDelayed, judgeTarget, placeInJudgmentArea } from '../shared/delayed';

const isStruck = (suit: string, rank: number) => suit === 'spade' && rank >= 2 && rank <= 9;

// Lightning: placed in the user's own judgment area (one per seat). Judged in
// the holder's Judgment Phase: a spade from 2 to 9 deals 3 damage to the
// holder, with no source, and Lightning is discarded. Anything else, or a
// Wuxie Kongjie, moves it on to the next living seat in seat order that holds
// no Lightning; with none, it stays.
export const lightningCard: CardDefinition = {
  id: 'lightning',
  name: 'Lightning',
  category: 'tool',
  delayed: true,
  legalPlayTargets: (state, ctx) => (holdsDelayed(state, ctx.seatId, 'lightning') ? [] : [[]]),
  play: (state, ctx) => (ctx.respondingTo ? [] : placeInJudgmentArea(state, ctx.cardInstanceId, ctx.seatId)),
  onTarget: judgeTarget,
  onJudged: (state, { tool, seatId, judged }) => {
    if (!isStruck(judged.suit, judged.rank)) return [];
    const card = tool.physical[0];
    const effects: Effect[] = [
      { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId }, amount: 3, nature: 'normal', ...(card ? { cause: { cardInstanceId: card.instanceId } } : {}) } },
    ];
    if (card) effects.push({ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id });
    return effects;
  },
  // Still in the holder's judgment area (it didn't strike): on to the next seat.
  onCleanup: (state, { tool, ownerSeatId }) => {
    const card = tool.physical[0];
    if (!card || !judgmentZoneOf(state, ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId)) return [];
    // Filtered rather than sliced: an eliminated holder isn't at the front.
    const next = livingSeatOrderFrom(state, ownerSeatId)
      .filter((id) => id !== ownerSeatId)
      .find((id) => !holdsDelayed(state, id, 'lightning'));
    return next ? placeInJudgmentArea(state, card.instanceId, next) : [];
  },
};
