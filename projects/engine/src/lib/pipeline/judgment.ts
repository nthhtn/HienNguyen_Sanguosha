import { GameState, Judgment } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { drawTop, judgmentZoneOf, requireZoneOfKind } from '../cards/zones';
import { skillOf } from '../skills/generalSkills';
import { ApplyResult, Effect, applyEffect } from './effects';
import { EngineEvent } from './events';
import { queueFront } from './queue';

const JUDGMENT_STEP_KINDS = new Set([
  'JudgeEffect',
  'JudgmentShownEffect',
  'JudgmentResolveEffect',
  'JudgmentDoneEffect',
  'ReplaceJudgmentEffect',
  'DelayedCleanupEffect',
]);
type JudgmentStepEffect = Extract<
  Effect,
  { kind: 'JudgeEffect' | 'JudgmentShownEffect' | 'JudgmentResolveEffect' | 'JudgmentDoneEffect' | 'ReplaceJudgmentEffect' | 'DelayedCleanupEffect' }
>;

export function isJudgmentStepEffect(effect: Effect): effect is JudgmentStepEffect {
  return JUDGMENT_STEP_KINDS.has(effect.kind);
}

// What the reader makes of the judgment's card.
function readJudgment(state: GameState, judgment: Judgment, done: Effect, registry: ContentRegistry): Effect[] {
  const { reader, seatId, card: judged, data } = judgment;
  const ctx = { seatId, judged, ...(data ? { data } : {}), done };
  if (reader.kind === 'card') return (lookupCard(registry, reader.card.as).onJudged?.(state, { tool: reader.card, ...ctx }) ?? []) as Effect[];
  return (skillOf(state, reader.owner, registry)?.onJudged?.(state, { owner: reader.owner, ...ctx }) ?? []) as Effect[];
}

// Judgments (turned up, shown, read, done; a card replaced) and delayed Tools'
// cleanup. Each asks the reader's definition what happens, so it needs the
// registry, as the Tool lifecycle does.
export function applyJudgmentStepEffect(state: GameState, effect: JudgmentStepEffect, registry: ContentRegistry): ApplyResult {
  const discardPile = requireZoneOfKind(state.zones, 'discardPile');
  const processing = requireZoneOfKind(state.zones, 'processing');
  switch (effect.kind) {
    case 'JudgeEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, 1, state.rng);
      const [judged] = drawn;
      // No card left anywhere to judge with: nothing is judged.
      if (!judged) return { state: queueFront(state, effect.otherwise ?? []), events: [] };
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'JudgmentEvent', seatId: effect.seatId, reader: effect.reader, card: judged },
      ];
      const judgment: Judgment = { seatId: effect.seatId, reader: effect.reader, card: judged, ...(effect.data ? { data: effect.data } : {}) };
      return { state: queueFront({ ...state, zones, rng, log: [...state.log, ...events] }, [{ kind: 'JudgmentShownEffect', judgment }]), events };
    }
    case 'JudgmentShownEffect':
      // Every skill that changes judgments has had its say: the card stands.
      return { state: queueFront(state, [{ kind: 'JudgmentResolveEffect', judgment: effect.judgment }]), events: [] };
    case 'JudgmentResolveEffect': {
      const done: Effect = { kind: 'JudgmentDoneEffect', judgment: effect.judgment };
      const readings = readJudgment(state, effect.judgment, done, registry);
      // The reader may have placed the card's trip itself; otherwise it comes last.
      const placed = readings.some((e) => e.kind === 'JudgmentDoneEffect');
      return { state: queueFront(state, placed ? readings : [...readings, done]), events: [] };
    }
    case 'JudgmentDoneEffect':
      // To the discard pile, unless something has taken it already.
      return applyEffect(state, { kind: 'MoveCardEffect', cardInstanceId: effect.judgment.card.instanceId, toZoneId: discardPile.id, onlyFrom: processing.id });
    case 'ReplaceJudgmentEffect': {
      const old = effect.judgment.card;
      const out = applyEffect(state, { kind: 'MoveCardEffect', cardInstanceId: old.instanceId, toZoneId: discardPile.id, onlyFrom: processing.id });
      const into = applyEffect(out.state, { kind: 'MoveCardEffect', cardInstanceId: effect.withCardInstanceId, toZoneId: processing.id });
      const card = requireZoneOfKind(into.state.zones, 'processing').cards.find((c) => c.instanceId === effect.withCardInstanceId)!;
      const changed: EngineEvent = { kind: 'JudgmentChangedEvent', owner: effect.owner, abilityId: effect.abilityId, judgedSeatId: effect.judgment.seatId, card, replaced: old };
      const next: GameState = { ...into.state, log: [...into.state.log, changed] };
      // Shown again: the other changers get their say on the new card.
      const shown: Effect = { kind: 'JudgmentShownEffect', judgment: { ...effect.judgment, card }, changedBy: effect.owner.seatId };
      return { state: queueFront(next, [shown]), events: [...out.events, ...into.events, changed] };
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
