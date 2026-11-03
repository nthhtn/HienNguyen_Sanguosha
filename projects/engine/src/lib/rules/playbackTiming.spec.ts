import { CardInstance, CardZone, EngineEvent, UsedCard } from '../domain/types';
import { BATCH_GAP_MS, SLOW_PLAYBACK_FACTOR, batchPlaybackMs, beatDurationMs } from './playbackTiming';

const zoneKindOf = (kinds: Record<string, CardZone['kind']> = {}) => (zoneId: string) => kinds[zoneId];
const context = (kinds: Record<string, CardZone['kind']> = {}, previous?: EngineEvent) => ({ zoneKindOf: zoneKindOf(kinds), previous });

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'spade', rank: 7 });
const used = (as: string, ...ids: string[]): UsedCard => ({ as, colour: 'black', physical: ids.map(card) });
const played = (as: string, targets: string[]): EngineEvent =>
  ({ kind: 'CardPlayedEvent', seatId: 'seat-0', card: used(as, 'c1'), targets: targets.map((seatId) => ({ kind: 'seat', seatId })) }) as EngineEvent;

const turn = { kind: 'TurnAdvancedEvent', seatId: 'seat-0', turnNumber: 1 } as EngineEvent;
const phase = { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Draw' } as EngineEvent;
const draw2 = { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a', 'b'] } as EngineEvent;
const pass = { kind: 'ResponsePassedEvent', seatId: 'seat-1', pendingResponseId: 'p', allowedCardIds: ['shan'] } as EngineEvent;

describe('beatDurationMs', () => {
  it.each<[string, EngineEvent, number]>([
    ['TurnAdvancedEvent', turn, 1000],
    ['PhaseChangedEvent', phase, 250],
    ['CardsDrawnEvent with 2 cards', draw2, 780],
    ['CardPlayedEvent at one target', played('sha', ['seat-1']), 900],
    ['CardPlayedEvent at three targets', played('sha', ['seat-1', 'seat-2', 'seat-3']), 1050],
    ['Coerce along a route', played('coerce', ['seat-1', 'seat-2']), 1200],
    ['ResponsePassedEvent', pass, 700],
  ])('%s takes %i ms', (_name, event, ms) => expect(beatDurationMs(event, context())).toBe(ms));

  it('an event kind with no entry takes 0 ms', () => {
    expect(beatDurationMs({ kind: 'SomethingElseEvent' } as unknown as EngineEvent, context())).toBe(0);
  });

  it('a card move takes 0 ms from a hand right after a play, 400 ms to a discard pile, 500 ms elsewhere', () => {
    const move = { kind: 'CardMovedEvent', cardInstanceId: 'c1', fromZoneId: 'hand', toZoneId: 'discard' } as EngineEvent;
    const kinds: Record<string, CardZone['kind']> = { hand: 'hand', discard: 'discardPile', draw: 'drawPile' };
    expect(beatDurationMs(move, context(kinds, played('sha', ['seat-1'])))).toBe(0);
    expect(beatDurationMs(move, context(kinds))).toBe(400);
    expect(beatDurationMs({ ...move, fromZoneId: 'draw', toZoneId: 'hand' } as EngineEvent, context(kinds))).toBe(500);
  });
});

describe('batchPlaybackMs', () => {
  it('has a batch gap and a Slow factor', () => {
    expect(BATCH_GAP_MS).toBe(350);
    expect(SLOW_PLAYBACK_FACTOR).toBe(0.5);
  });

  it('is 0 for no events', () => expect(batchPlaybackMs([], zoneKindOf())).toBe(0));

  it('one turn banner takes 2700 ms at Slow and 1350 ms at Normal', () => {
    expect(batchPlaybackMs([turn], zoneKindOf())).toBe(2700);
    expect(batchPlaybackMs([turn], zoneKindOf(), undefined, 1)).toBe(1350);
  });

  it('two phase changes and a draw of two take (250 + 250 + 780 + 350) / 0.5 ms', () => {
    expect(batchPlaybackMs([phase, phase, draw2], zoneKindOf())).toBe(3260);
  });

  it('the first event is read against the event before the batch', () => {
    const move = { kind: 'CardMovedEvent', cardInstanceId: 'c1', fromZoneId: 'hand', toZoneId: 'discard' } as EngineEvent;
    const kinds: Record<string, CardZone['kind']> = { hand: 'hand', discard: 'discardPile' };
    expect(batchPlaybackMs([move], zoneKindOf(kinds), played('sha', ['seat-1']))).toBe((0 + 350) / 0.5);
    expect(batchPlaybackMs([move], zoneKindOf(kinds))).toBe((400 + 350) / 0.5);
  });

  it('a played card followed by its move is read against the play inside the batch', () => {
    const move = { kind: 'CardMovedEvent', cardInstanceId: 'c1', fromZoneId: 'hand', toZoneId: 'discard' } as EngineEvent;
    const kinds: Record<string, CardZone['kind']> = { hand: 'hand', discard: 'discardPile' };
    expect(batchPlaybackMs([played('sha', ['seat-1']), move], zoneKindOf(kinds))).toBe((900 + 0 + 350) / 0.5);
  });
});
