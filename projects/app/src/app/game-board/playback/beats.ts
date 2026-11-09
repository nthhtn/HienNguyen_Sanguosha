import { BATCH_GAP_MS, BeatTimingContext, CHAINED_TARGET_CARDS, CardInstance, EngineEvent, Phase, UsedCard, beatDurationMs } from 'engine';

// What a beat shows; the seat cues and the overlay read these.
export type BeatVisual =
  | { kind: 'turn'; seatId: string }
  | { kind: 'phase'; seatId: string; phase: Phase }
  | { kind: 'draw'; seatId: string; count: number }
  | { kind: 'play'; seatId: string; card: UsedCard; targetSeatIds: string[]; chained?: true; answersSeatId?: string; response: boolean }
  | { kind: 'pass'; seatId: string; cardId?: string }
  | { kind: 'move'; cardInstanceId: string; fromZoneId: string; toZoneId: string; card?: CardInstance }
  | { kind: 'damage'; seatId: string; amount: number; sourceSeatId?: string }
  | { kind: 'heal'; seatId: string; amount: number }
  | { kind: 'dying'; seatId: string }
  | { kind: 'saved'; seatId: string }
  | { kind: 'reveal'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'eliminated'; seatId: string }
  | { kind: 'ability'; seatId: string; abilityId: string };

export interface PlannedBeat {
  logIndex: number;
  event: EngineEvent;
  durationMs: number;
  visual: BeatVisual | null;
}

export type BeatContext = BeatTimingContext;

type BeatDefinition<E extends EngineEvent> = {
  visual: (event: E, context: BeatContext) => BeatVisual | null;
};

// The pause between two batches, and every duration, are shared with the server (engine's playbackTiming).
export { BATCH_GAP_MS };

// What each event shows. How long it shows for is `beatDurationMs`.
export const BEATS: { [K in EngineEvent['kind']]?: BeatDefinition<Extract<EngineEvent, { kind: K }>> } = {
  TurnAdvancedEvent: { visual: (e) => ({ kind: 'turn', seatId: e.seatId }) },
  PhaseChangedEvent: { visual: (e) => ({ kind: 'phase', seatId: e.seatId, phase: e.phase }) },
  CardsDrawnEvent: { visual: (e) => ({ kind: 'draw', seatId: e.seatId, count: e.cardInstanceIds.length }) },
  CardPlayedEvent: {
    visual: (e) => ({
      kind: 'play',
      seatId: e.seatId,
      card: e.card,
      targetSeatIds: e.targets.map((t) => t.seatId),
      ...(CHAINED_TARGET_CARDS.has(e.card.as) && e.targets.length > 1 ? { chained: true as const } : {}),
      answersSeatId: e.card.as === 'peach' && e.inResponseTo?.dyingSeatId ? e.inResponseTo.dyingSeatId : e.inResponseTo?.seatId,
      response: !!e.inResponseTo,
    }),
  },
  ResponsePassedEvent: { visual: (e) => ({ kind: 'pass', seatId: e.seatId, cardId: e.allowedCardIds?.[0] }) },
  CardMovedEvent: { visual: (e) => ({ kind: 'move', cardInstanceId: e.cardInstanceId, fromZoneId: e.fromZoneId, toZoneId: e.toZoneId, card: e.card }) },
  DamageDealtEvent: { visual: (e) => ({ kind: 'damage', seatId: e.damage.target.seatId, amount: e.damage.amount, sourceSeatId: e.damage.source?.seatId }) },
  HpLostEvent: { visual: (e) => ({ kind: 'damage', seatId: e.seatId, amount: e.amount }) },
  HealEvent: { visual: (e) => ({ kind: 'heal', seatId: e.target.seatId, amount: e.amount }) },
  SeatDyingEvent: { visual: (e) => ({ kind: 'dying', seatId: e.seatId }) },
  SeatSavedEvent: { visual: (e) => ({ kind: 'saved', seatId: e.seatId }) },
  GeneralRevealedEvent: { visual: (e) => ({ kind: 'reveal', seatId: e.seatId, slot: e.slot }) },
  SeatEliminatedEvent: { visual: (e) => ({ kind: 'eliminated', seatId: e.seatId }) },
  AbilityUsedEvent: { visual: (e) => ({ kind: 'ability', seatId: e.owner.seatId, abilityId: e.abilityId }) },
};

export function planBeat(event: EngineEvent, logIndex: number, context: BeatContext): PlannedBeat {
  // The registry is keyed by kind, so the entry always matches this event.
  const definition = BEATS[event.kind] as BeatDefinition<EngineEvent> | undefined;
  const durationMs = beatDurationMs(event, context);
  if (!definition) return { logIndex, event, durationMs, visual: null };
  return { logIndex, event, durationMs, visual: definition.visual(event, context) };
}
