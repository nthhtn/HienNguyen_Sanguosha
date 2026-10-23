import type { CardMovedEvent, EngineEvent, GameState } from 'engine';
import { isLastMoveOfStep } from './skills';

const move = (cardInstanceId: string): CardMovedEvent => ({ kind: 'CardMovedEvent', cardInstanceId, fromZoneId: 'seat-a:hand', toZoneId: 'discardPile' });
const withLog = (log: EngineEvent[]) => ({ log }) as GameState;

describe('isLastMoveOfStep', () => {
  it('is true only for the last card move logged', () => {
    const log = [move('x1'), move('x2'), move('x3')];
    expect(isLastMoveOfStep(withLog(log), log[0])).toBe(false);
    expect(isLastMoveOfStep(withLog(log), log[1])).toBe(false);
    expect(isLastMoveOfStep(withLog(log), log[2])).toBe(true);
  });

  it('still finds the last move when another event was logged after it in the same step', () => {
    const log: EngineEvent[] = [move('x1'), move('x2'), { kind: 'JudgmentChangedEvent' } as EngineEvent];
    expect(isLastMoveOfStep(withLog(log), log[0] as CardMovedEvent)).toBe(false);
    expect(isLastMoveOfStep(withLog(log), log[1] as CardMovedEvent)).toBe(true);
  });

  it('is false when no card move was logged', () => {
    expect(isLastMoveOfStep(withLog([]), move('x1'))).toBe(false);
  });
});
