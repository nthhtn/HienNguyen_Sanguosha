import type { CardDefinition, CardInstance, ContentRegistry, Effect, GameState } from 'engine';
import { judgmentZoneOf, livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { holdsDelayed, judgeTarget, placeInJudgmentArea } from '../shared/delayed';
import { suitOf } from '../shared/suits';

const isStruck = (suit: string, rank: number) => suit === 'spade' && rank >= 2 && rank <= 9;

// Whether a judged card strikes (a spade from 2 to 9, as the judged seat counts suits).
export const lightningStrikes = (state: GameState, seatId: string, judged: CardInstance, registry: ContentRegistry): boolean => isStruck(suitOf(state, seatId, judged, registry), judged.rank);

// The seat Lightning goes to when it didn't strike: the next living seat in seat order that
// holds none (filtered rather than sliced: an eliminated holder isn't at the front); null if none.
function nextLightningSeat(state: GameState, ownerSeatId: string): string | null {
  return livingSeatOrderFrom(state, ownerSeatId).filter((id) => id !== ownerSeatId).find((id) => !holdsDelayed(state, id, 'lightning')) ?? null;
}

// What a judged card does to Lightning: strikes the judged seat, moves on, or stays.
export function lightningOutcome(state: GameState, seatId: string, judged: CardInstance, registry: ContentRegistry): 'struck' | 'moves' | 'stays' {
  if (lightningStrikes(state, seatId, judged, registry)) return 'struck';
  return nextLightningSeat(state, seatId) ? 'moves' : 'stays';
}

// Lightning: placed in the user's own judgment area (one per seat). Judged in
// the holder's Judgment Phase: a spade from 2 to 9 discards Lightning, then
// deals 3 thunder damage to the holder, with no source. Anything else, or a
// Wuxie Kongjie, moves it on to the next living seat in seat order that holds
// no Lightning; with none, it stays.
export const lightningCard: CardDefinition = {
  id: 'lightning',
  name: 'Lightning',
  category: 'tool',
  delayed: true,
  legalPlayTargets: (state, ctx) => (holdsDelayed(state, ctx.seatId, 'lightning') ? [] : [[]]),
  play: (state, ctx) => (ctx.respondingTo ? [] : placeInJudgmentArea(state, ctx.cardInstanceId, ctx.seatId, ctx.card.as)),
  onTarget: judgeTarget,
  onJudged: (state, { tool, seatId, judged }, registry) => {
    if (!lightningStrikes(state, seatId, judged, registry)) return [];
    const card = tool.physical[0];
    const effects: Effect[] = [];
    // To the discard pile first, so a skill reacting to the damage can take it (Evil Hero).
    if (card) effects.push({ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id });
    effects.push({
      kind: 'DamageEffect',
      damage: { source: null, target: { kind: 'seat', seatId }, amount: 3, nature: 'thunder', cause: { ...(card ? { cardInstanceId: card.instanceId } : {}), card: tool } },
    });
    return effects;
  },
  // Still in the holder's judgment area (it didn't strike): on to the next seat.
  onCleanup: (state, { tool, ownerSeatId }) => {
    const card = tool.physical[0];
    if (!card || !judgmentZoneOf(state, ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId)) return [];
    const next = nextLightningSeat(state, ownerSeatId);
    return next ? placeInJudgmentArea(state, card.instanceId, next, tool.as) : [];
  },
};
