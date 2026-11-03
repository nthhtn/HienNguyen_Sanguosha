import { CardZone } from '../domain/types';
import { EngineEvent } from '../pipeline/events';

// How long each event plays on screen, so a server can wait for an animation as long as a client plays it.
// Read by the app (its battle playback) and by the server (which paces bots and clocks). Durations are at
// Normal speed; Slow plays them at SLOW_PLAYBACK_FACTOR.

// The pause between two batches of events.
export const BATCH_GAP_MS = 350;

// Every game plays at Slow for now (the speed setting is hidden): a duration is `ms / factor`.
export const SLOW_PLAYBACK_FACTOR = 0.5;

// What an event alone doesn't say: a zone's kind, and the event before it.
export interface BeatTimingContext {
  zoneKindOf(zoneId: string): CardZone['kind'] | undefined;
  previous?: EngineEvent;
}

type DurationOf<E extends EngineEvent> = (event: E, context: BeatTimingContext) => number;

// Cards whose targets are a route, not a fan-out: the arrows run user to first target, then on to the next (Coerce:
// the holder, then the seat its Sha is aimed at).
export const CHAINED_TARGET_CARDS: ReadonlySet<string> = new Set(['coerce']);

const fixed = (ms: number) => () => ms;

// A kind with no entry gets a 0 ms beat.
export const BEAT_DURATION_MS: { [K in EngineEvent['kind']]?: DurationOf<Extract<EngineEvent, { kind: K }>> } = {
  TurnAdvancedEvent: fixed(1000),
  PhaseChangedEvent: fixed(250),
  CardsDrawnEvent: (e) => 500 + 140 * e.cardInstanceIds.length,
  CardPlayedEvent: (e) => 900 + (e.targets.length > 2 ? 150 : 0) + (CHAINED_TARGET_CARDS.has(e.card.as) && e.targets.length > 1 ? 300 : 0),
  ResponsePassedEvent: fixed(700),
  CardMovedEvent: (e, context) => {
    if (context.previous?.kind === 'CardPlayedEvent' && context.zoneKindOf(e.fromZoneId) === 'hand') return 0;
    return context.zoneKindOf(e.toZoneId) === 'discardPile' ? 400 : 500;
  },
  DamageDealtEvent: fixed(900),
  HpLostEvent: fixed(900),
  HealEvent: fixed(800),
  SeatDyingEvent: fixed(900),
  SeatSavedEvent: fixed(300),
  GeneralRevealedEvent: fixed(700),
  SeatEliminatedEvent: fixed(1400),
  AbilityUsedEvent: fixed(700),
};

export function beatDurationMs(event: EngineEvent, context: BeatTimingContext): number {
  // The table is keyed by kind, so the entry always matches this event.
  const duration = BEAT_DURATION_MS[event.kind] as DurationOf<EngineEvent> | undefined;
  return duration ? duration(event, context) : 0;
}

// The real milliseconds a batch of events takes to play at `factor`: every beat, then the gap. 0 for no events.
// `previous` is the event before the first one, the context its beat is read against.
export function batchPlaybackMs(events: readonly EngineEvent[], zoneKindOf: BeatTimingContext['zoneKindOf'], previous?: EngineEvent, factor: number = SLOW_PLAYBACK_FACTOR): number {
  if (events.length === 0) return 0;
  const beats = events.reduce((sum, event, i) => sum + beatDurationMs(event, { zoneKindOf, previous: i === 0 ? previous : events[i - 1] }), 0);
  return Math.round((beats + BATCH_GAP_MS) / factor);
}
