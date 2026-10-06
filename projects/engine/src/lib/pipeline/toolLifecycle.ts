import { DecisionReason, GameState, PendingResponse } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { livingSeatOrderFrom } from '../rules/seatOrder';
import { ApplyResult, Effect } from './effects';
import { queueFront, withQueue } from './queue';

type LifecycleEffect = Extract<Effect, { kind: 'ToolOnTargetEffect' | 'ToolRuleEffect' | 'WuxieCheckEffect' | 'SkipNextEffect' }>;

export function isLifecycleEffect(effect: Effect): effect is LifecycleEffect {
  return effect.kind === 'ToolOnTargetEffect' || effect.kind === 'ToolRuleEffect' || effect.kind === 'WuxieCheckEffect' || effect.kind === 'SkipNextEffect';
}

const isLiving = (state: GameState, seatId: string) => !!state.seats.find((s) => s.id === seatId && !s.eliminated);

// The Tool lifecycle's effects. They only reshape the queue or open a window,
// so they log no events.
export function applyLifecycleEffect(state: GameState, effect: LifecycleEffect, registry: ContentRegistry): ApplyResult {
  switch (effect.kind) {
    case 'ToolOnTargetEffect': {
      // A target gone before its turn comes is simply skipped.
      if (effect.target.kind === 'seat' && !isLiving(state, effect.target.seatId)) return { state, events: [] };
      const extra = effect.extra ? { extra: effect.extra } : {};
      return {
        state: queueFront(state, [
          {
            kind: 'WuxieCheckEffect',
            subject: { kind: 'tool', tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target },
            order: livingSeatOrderFrom(state, effect.userSeatId),
            counterCardIds: effect.counterCardIds,
          },
          { kind: 'ToolRuleEffect', tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target, ...extra },
        ]),
        events: [],
      };
    }
    case 'ToolRuleEffect': {
      const definition = lookupCard(registry, effect.tool.as);
      if (!definition.onTarget) throw new Error(`Tool ${effect.tool.as} has no onTarget rule`);
      const extra = effect.extra ? { extra: effect.extra } : {};
      const effects = definition.onTarget(state, { tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target, ...extra }) as Effect[];
      return { state: queueFront(state, effects), events: [] };
    }
    case 'WuxieCheckEffect':
      return applyWuxieCheck(state, effect);
    case 'SkipNextEffect':
      return { state: withQueue(state, (state.resolutionQueue ?? []).slice(1)), events: [] };
  }
}

function applyWuxieCheck(state: GameState, effect: Extract<Effect, { kind: 'WuxieCheckEffect' }>): ApplyResult {
  const holdsCounter = (seatId: string) => {
    const seat = state.seats.find((s) => s.id === seatId);
    const hand = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
    return !!hand?.cards.some((c) => effect.counterCardIds.includes(c.definitionId));
  };
  const index = effect.order.findIndex((seatId) => isLiving(state, seatId) && holdsCounter(seatId));
  if (index === -1) return { state, events: [] };

  const askerId = effect.order[index];
  const subject = effect.subject;
  const reason: DecisionReason =
    subject.kind === 'tool'
      ? { kind: 'wuxie', tool: subject.tool, toolUserSeatId: subject.userSeatId, target: subject.target }
      : { kind: 'counter-wuxie', wuxieSeatId: subject.seatId };
  const pendingResponse: PendingResponse = {
    id: `wuxie-check-${state.log.length}-${askerId}`,
    respondingSeatId: askerId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: effect.counterCardIds,
    reason,
    // Pass: ask the next holder about the same thing.
    context: { effect: { ...effect, order: effect.order.slice(index + 1) } },
    // A counter card: everyone after its player may counter it in turn; if
    // none does, it skips what it guards (the Tool's rule, or another counter's skip).
    onAnswer: [
      { kind: 'WuxieCheckEffect', subject: { kind: 'counter', seatId: askerId }, order: livingSeatOrderFrom(state, askerId).slice(1), counterCardIds: effect.counterCardIds },
      { kind: 'SkipNextEffect' },
    ],
  };
  return { state: { ...state, pendingResponse }, events: [] };
}
