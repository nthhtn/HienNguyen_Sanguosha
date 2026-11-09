import type { EngineEvent } from 'engine';
import { resolutionSpans } from './resolution-spans';

const registered = (id: string) => ['blaze', 'break', 'resurgence'].includes(id);
const used = (as: string) => ({ as, colour: 'red' as const, physical: [] });
const play = (seatId: string, as: string, target: string, inResponseTo?: object): EngineEvent =>
  ({ kind: 'CardPlayedEvent', seatId, card: used(as), targets: [{ kind: 'seat', seatId: target }], ...(inResponseTo ? { inResponseTo } : {}) }) as EngineEvent;
const damage = { kind: 'DamageDealtEvent', damage: { target: { kind: 'seat', seatId: 'b' }, amount: 1 } } as unknown as EngineEvent;
const phase = { kind: 'PhaseChangedEvent', seatId: 'a', phase: 'Draw' } as unknown as EngineEvent;
const ability = (abilityId: string, seatId: string): EngineEvent => ({ kind: 'AbilityUsedEvent', owner: { kind: 'general', seatId, slot: 'main', skillId: abilityId }, abilityId, outcome: 'revealed' }) as unknown as EngineEvent;

describe('resolutionSpans', () => {
  it('a settled Blaze is one span, from its play to the last event', () => {
    const log = [phase, play('a', 'blaze', 'b'), damage];
    const { spans, resumeFrom } = resolutionSpans(log, 0, true, registered);
    expect(spans.map((s) => [s.span.sourceId, s.span.userSeatId, s.span.targetSeatIds, s.span.startIndex, s.endIndex])).toEqual([['blaze', 'a', ['b'], 1, 2]]);
    expect(spans[0].span.events).toEqual([log[1], log[2]]);
    expect(resumeFrom).toBe(3);
  });

  it('a resolution still waiting on a decision is not finished, and is looked at again from its play', () => {
    const { spans, resumeFrom } = resolutionSpans([phase, play('a', 'blaze', 'b')], 0, false, registered);
    expect(spans).toEqual([]);
    expect(resumeFrom).toBe(1);
  });

  it('two plays in one range are two spans, in order', () => {
    const log = [play('a', 'blaze', 'b'), damage, play('a', 'break', 'b')];
    const { spans } = resolutionSpans(log, 0, true, registered);
    expect(spans.map((s) => [s.span.sourceId, s.span.startIndex, s.endIndex])).toEqual([['blaze', 0, 1], ['break', 2, 2]]);
  });

  it('a card with no notice makes no span, and ends the one before it', () => {
    const log = [play('a', 'blaze', 'b'), play('a', 'sha', 'b')];
    expect(resolutionSpans(log, 0, true, registered).spans.map((s) => s.endIndex)).toEqual([0]);
  });

  it('an answer to the card is part of its span, and does not end it', () => {
    const log = [play('a', 'break', 'b'), play('c', 'wuxie', 'b', { targetSeatId: 'b' }), damage];
    const { spans } = resolutionSpans(log, 0, true, registered);
    expect(spans).toHaveLength(1);
    expect(spans[0].span.events).toHaveLength(3);
  });

  it('a phase change ends a span even while the state is not settled', () => {
    const { spans, resumeFrom } = resolutionSpans([play('a', 'blaze', 'b'), phase], 0, false, registered);
    expect(spans.map((s) => s.endIndex)).toEqual([0]);
    expect(resumeFrom).toBe(2);
  });

  it('a skill with a notice opens a span at its own announcement', () => {
    const log = [phase, ability('resurgence', 'a'), damage];
    const { spans } = resolutionSpans(log, 0, true, registered);
    expect(spans.map((s) => [s.span.sourceId, s.span.userSeatId, s.span.startIndex, s.endIndex])).toEqual([['resurgence', 'a', 1, 2]]);
  });

  it('only looks from the given index', () => {
    const log = [play('a', 'blaze', 'b'), damage, play('a', 'break', 'b')];
    expect(resolutionSpans(log, 2, true, registered).spans.map((s) => s.span.sourceId)).toEqual(['break']);
  });
});
