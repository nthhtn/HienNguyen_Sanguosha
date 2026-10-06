import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { drawTop, judgmentZoneOf, requireZoneOfKind } from '../cards/zones';
import { ApplyResult, Effect } from './effects';
import { EngineEvent } from './events';
import { queueFront } from './queue';

type JudgmentStepEffect = Extract<Effect, { kind: 'JudgeEffect' | 'DelayedCleanupEffect' }>;

export function isJudgmentStepEffect(effect: Effect): effect is JudgmentStepEffect {
  return effect.kind === 'JudgeEffect' || effect.kind === 'DelayedCleanupEffect';
}

// Judgments and delayed Tools' cleanup. Both ask the card's definition what
// happens, so they need the registry, as the Tool lifecycle does.
export function applyJudgmentStepEffect(state: GameState, effect: JudgmentStepEffect, registry: ContentRegistry): ApplyResult {
  const discardPile = requireZoneOfKind(state.zones, 'discardPile');
  switch (effect.kind) {
    case 'JudgeEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const processing = requireZoneOfKind(state.zones, 'processing');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, 1, state.rng);
      const [judged] = drawn;
      // No card left anywhere to judge with: nothing is judged.
      if (!judged) return { state, events: [] };
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'JudgmentEvent', seatId: effect.seatId, tool: effect.tool, card: judged },
      ];
      const turnedUp: GameState = { ...state, zones, rng, log: [...state.log, ...events] };
      const readings = (lookupCard(registry, effect.tool.as).onJudged?.(turnedUp, { tool: effect.tool, seatId: effect.seatId, judged }) ?? []) as Effect[];
      const done: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: discardPile.id };
      return { state: queueFront(turnedUp, [...readings, done]), events };
    }
    case 'DelayedCleanupEffect': {
      const definition = lookupCard(registry, effect.tool.as);
      if (definition.onCleanup) {
        return { state: queueFront(state, definition.onCleanup(state, { tool: effect.tool, ownerSeatId: effect.ownerSeatId }) as Effect[]), events: [] };
      }
      const card = effect.tool.physical[0];
      const stillThere = !!card && !!judgmentZoneOf(state, effect.ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId);
      if (!stillThere) return { state, events: [] };
      return { state: queueFront(state, [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id }]), events: [] };
    }
  }
}
