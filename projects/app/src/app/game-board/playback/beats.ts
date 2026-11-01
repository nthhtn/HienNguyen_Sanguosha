import { CardInstance, CardZone, EngineEvent, Phase, UsedCard } from 'engine';

// What a beat shows; the seat cues and the overlay read these.
export type BeatVisual =
  | { kind: 'turn'; seatId: string }
  | { kind: 'phase'; seatId: string; phase: Phase }
  | { kind: 'draw'; seatId: string; count: number }
  | { kind: 'play'; seatId: string; card: UsedCard; targetSeatIds: string[]; answersSeatId?: string; response: boolean }
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

// What an event alone doesn't say: a zone's kind, and the event before it.
export interface BeatContext {
  zoneKindOf(zoneId: string): CardZone['kind'] | undefined;
  previous?: EngineEvent;
}

type BeatDefinition<E extends EngineEvent> = {
  durationMs: (event: E, context: BeatContext) => number;
  visual: (event: E, context: BeatContext) => BeatVisual | null;
};

// The pause between two batches of events.
export const BATCH_GAP_MS = 350;

const fixed = (ms: number) => () => ms;

// Durations are at Normal speed. A kind with no entry gets a 0 ms beat.
export const BEATS: { [K in EngineEvent['kind']]?: BeatDefinition<Extract<EngineEvent, { kind: K }>> } = {
  TurnAdvancedEvent: { durationMs: fixed(1000), visual: (e) => ({ kind: 'turn', seatId: e.seatId }) },
  PhaseChangedEvent: { durationMs: fixed(250), visual: (e) => ({ kind: 'phase', seatId: e.seatId, phase: e.phase }) },
  CardsDrawnEvent: {
    durationMs: (e) => 500 + 140 * e.cardInstanceIds.length,
    visual: (e) => ({ kind: 'draw', seatId: e.seatId, count: e.cardInstanceIds.length }),
  },
  CardPlayedEvent: {
    durationMs: (e) => 900 + (e.targets.length > 2 ? 150 : 0),
    visual: (e) => ({
      kind: 'play',
      seatId: e.seatId,
      card: e.card,
      targetSeatIds: e.targets.map((t) => t.seatId),
      answersSeatId: e.card.as === 'peach' && e.inResponseTo?.dyingSeatId ? e.inResponseTo.dyingSeatId : e.inResponseTo?.seatId,
      response: !!e.inResponseTo,
    }),
  },
  ResponsePassedEvent: {
    durationMs: fixed(700),
    visual: (e) => ({ kind: 'pass', seatId: e.seatId, cardId: e.allowedCardIds?.[0] }),
  },
  CardMovedEvent: {
    durationMs: (e, context) => {
      if (context.previous?.kind === 'CardPlayedEvent' && context.zoneKindOf(e.fromZoneId) === 'hand') return 0;
      return context.zoneKindOf(e.toZoneId) === 'discardPile' ? 400 : 500;
    },
    visual: (e) => ({ kind: 'move', cardInstanceId: e.cardInstanceId, fromZoneId: e.fromZoneId, toZoneId: e.toZoneId, card: e.card }),
  },
  DamageDealtEvent: {
    durationMs: fixed(900),
    visual: (e) => ({ kind: 'damage', seatId: e.damage.target.seatId, amount: e.damage.amount, sourceSeatId: e.damage.source?.seatId }),
  },
  HpLostEvent: { durationMs: fixed(900), visual: (e) => ({ kind: 'damage', seatId: e.seatId, amount: e.amount }) },
  HealEvent: { durationMs: fixed(800), visual: (e) => ({ kind: 'heal', seatId: e.target.seatId, amount: e.amount }) },
  SeatDyingEvent: { durationMs: fixed(900), visual: (e) => ({ kind: 'dying', seatId: e.seatId }) },
  SeatSavedEvent: { durationMs: fixed(300), visual: (e) => ({ kind: 'saved', seatId: e.seatId }) },
  GeneralRevealedEvent: { durationMs: fixed(700), visual: (e) => ({ kind: 'reveal', seatId: e.seatId, slot: e.slot }) },
  SeatEliminatedEvent: { durationMs: fixed(1400), visual: (e) => ({ kind: 'eliminated', seatId: e.seatId }) },
  AbilityUsedEvent: { durationMs: fixed(700), visual: (e) => ({ kind: 'ability', seatId: e.owner.seatId, abilityId: e.abilityId }) },
};

export function planBeat(event: EngineEvent, logIndex: number, context: BeatContext): PlannedBeat {
  // The registry is keyed by kind, so the entry always matches this event.
  const definition = BEATS[event.kind] as BeatDefinition<EngineEvent> | undefined;
  if (!definition) return { logIndex, event, durationMs: 0, visual: null };
  return { logIndex, event, durationMs: definition.durationMs(event, context), visual: definition.visual(event, context) };
}
