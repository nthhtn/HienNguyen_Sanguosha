import { DecisionReason, GameState, PendingResponse, UsedCard, WuxieSubject } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { livingSeatOrderFrom } from '../rules/seatOrder';
import { answerConditionMet, answeringConversions } from '../rules/legality';
import { answersAs, toolKeyOf } from '../domain/usedCard';
import { ApplyResult, Effect, withToolCancellations } from './effects';
import { queueFront, withQueue } from './queue';

type LifecycleEffect = Extract<Effect, { kind: 'ToolOnTargetEffect' | 'ToolRuleEffect' | 'WuxieCheckEffect' | 'SkipNextEffect' | 'CancelToolForKingdomEffect' }>;

const LIFECYCLE_KINDS: readonly string[] = ['ToolOnTargetEffect', 'ToolRuleEffect', 'WuxieCheckEffect', 'SkipNextEffect', 'CancelToolForKingdomEffect'];

export function isLifecycleEffect(effect: Effect): effect is LifecycleEffect {
  return LIFECYCLE_KINDS.includes(effect.kind);
}

const seatOf = (target: { seatId: string }) => target.seatId;

// Whether `seatId`'s live Kingdom has had `tool` cancelled for it (Wuxie Kingdom).
function cancelledForKingdom(state: GameState, tool: UsedCard, seatId: string): boolean {
  const kingdom = state.seats.find((s) => s.id === seatId)?.kingdom;
  if (!kingdom || kingdom === 'hidden') return false;
  const key = toolKeyOf(tool);
  return (state.toolCancellations ?? []).some((c) => c.toolKey === key && c.kingdom === kingdom);
}

const isLiving = (state: GameState, seatId: string) => !!state.seats.find((s) => s.id === seatId && !s.eliminated);

// The Tool lifecycle's effects. They only reshape the queue or open a window,
// so they log no events.
export function applyLifecycleEffect(state: GameState, effect: LifecycleEffect, registry: ContentRegistry): ApplyResult {
  switch (effect.kind) {
    case 'ToolOnTargetEffect': {
      // A target gone before its turn comes is simply skipped.
      if (effect.target.kind === 'seat' && !isLiving(state, effect.target.seatId)) return { state, events: [] };
      // A target of a Kingdom the Tool was cancelled for: no check, no rule.
      if (cancelledForKingdom(state, effect.tool, seatOf(effect.target))) return { state, events: [] };
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
      // The Tool takes effect here after all: a Kingdom cancel played about
      // this target was itself countered, so it cancels no one.
      const key = toolKeyOf(effect.tool);
      const cancels = state.toolCancellations ?? [];
      const standing = cancels.filter((c) => !(c.toolKey === key && c.targetSeatId === seatOf(effect.target)));
      const current = standing.length === cancels.length ? state : withToolCancellations(state, standing);
      const definition = lookupCard(registry, effect.tool.as);
      if (!definition.onTarget) throw new Error(`Tool ${effect.tool.as} has no onTarget rule`);
      const extra = effect.extra ? { extra: effect.extra } : {};
      const effects = definition.onTarget(current, { tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target, ...extra }, registry) as Effect[];
      return { state: queueFront(current, effects), events: [] };
    }
    case 'WuxieCheckEffect':
      return applyWuxieCheck(state, effect, registry);
    case 'SkipNextEffect':
      return { state: withQueue(state, (state.resolutionQueue ?? []).slice(1)), events: [] };
    case 'CancelToolForKingdomEffect': {
      // Recorded only while a later target of this Tool is still queued (a
      // delayed Tool's judgment has none): nothing else would read it.
      const key = toolKeyOf(effect.tool);
      const later = (state.resolutionQueue ?? []).some((item) => item.kind === 'ToolOnTargetEffect' && toolKeyOf((item as { tool: UsedCard }).tool) === key);
      if (!later) return { state, events: [] };
      const record = { toolKey: key, kingdom: effect.kingdom, targetSeatId: effect.targetSeatId };
      return { state: withToolCancellations(state, [...(state.toolCancellations ?? []), record]), events: [] };
    }
  }
}

function subjectKey(subject: WuxieSubject): string {
  if (subject.kind === 'counter') return `counter-${subject.seatId}`;
  const target = subject.target.kind === 'seat' ? subject.target.seatId : `${subject.target.seatId}-${subject.target.generalSlot}`;
  return `${subject.tool.as}-${subject.tool.physical[0]?.instanceId ?? 'virtual'}-${target}`;
}

function applyWuxieCheck(state: GameState, effect: Extract<Effect, { kind: 'WuxieCheckEffect' }>, registry: ContentRegistry): ApplyResult {
  const subject = effect.subject;
  // A Tool use marked noWuxie is never checked (a counter card is always checkable).
  if (subject.kind === 'tool' && subject.tool.noWuxie) return { state, events: [] };
  const reason: DecisionReason =
    subject.kind === 'tool'
      ? { kind: 'wuxie', tool: subject.tool, toolUserSeatId: subject.userSeatId, target: subject.target }
      : { kind: 'counter-wuxie', wuxieSeatId: subject.seatId };
  const windowFor = (index: number): PendingResponse => {
    const askerId = effect.order[index];
    return {
      // Names what is asked, not only who and when: a pass logs nothing, so the
      // same seat can be asked about a counter and then the next target at the
      // same log length, and the UI tells windows apart by id.
      id: `wuxie-check-${state.log.length}-${askerId}-${subjectKey(subject)}`,
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
  };
  // A counter card in hand that may answer this window, or a conversion that makes one.
  const holdsCounter = (index: number) => {
    const seatId = effect.order[index];
    const seat = state.seats.find((s) => s.id === seatId);
    const hand = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
    const window = windowFor(index);
    return (
      !!hand?.cards.some((c) => answersAs(c.definitionId, effect.counterCardIds, registry) && answerConditionMet(state, window, seatId, c.definitionId, registry)) ||
      answeringConversions(state, seatId, effect.counterCardIds, registry, { revealedOnly: true }).some((o) => answerConditionMet(state, window, seatId, o.conversion.as, registry))
    );
  };
  const index = effect.order.findIndex((seatId, i) => isLiving(state, seatId) && holdsCounter(i));
  if (index === -1) return { state, events: [] };
  return { state: { ...state, pendingResponse: windowFor(index) }, events: [] };
}
