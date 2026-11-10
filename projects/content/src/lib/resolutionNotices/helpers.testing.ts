import type { EngineEvent, GameState } from 'engine';
import type { ResolutionSpan } from '../resolutionNotice';

export const view = (log: EngineEvent[] = []) =>
  ({
    seats: ['a', 'b', 'c'].map((id) => ({ id, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` } })),
    zones: [{ id: 'discardPile', kind: 'discardPile', cards: [] }],
    log,
  }) as unknown as GameState;

export const played = (as: string, seatId: string, targets: string[]): EngineEvent =>
  ({ kind: 'CardPlayedEvent', seatId, card: { as, colour: 'red', physical: [{ instanceId: `${as}-1` }] }, targets: targets.map((t) => ({ kind: 'seat', seatId: t })) }) as unknown as EngineEvent;

export const drew = (seatId: string, n: number): EngineEvent => ({ kind: 'CardsDrawnEvent', seatId, cardInstanceIds: Array.from({ length: n }, (_, i) => `d${seatId}${i}`) }) as unknown as EngineEvent;

export const span = (sourceId: string, userSeatId: string, targetSeatIds: string[], events: EngineEvent[], startIndex = 0): ResolutionSpan => ({
  sourceId, userSeatId, targetSeatIds, startIndex, endIndex: startIndex + events.length - 1, events,
});
