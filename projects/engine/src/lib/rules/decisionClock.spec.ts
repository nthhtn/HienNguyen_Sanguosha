import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { DecisionSpec, EMPTY_CLOCK, clockRemainingMs, describeDecision, expireClock, switchClock } from './decisionClock';

const state = (fields: object): GameState =>
  ({ phase: 'Play', turn: { turnNumber: 3, ownerSeatId: 'seat-0' }, result: null, pendingResponse: null, ...fields }) as unknown as GameState;
const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const discard: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' };

describe('describeDecision', () => {
  it('is null when the game is over or the seat has nothing to do', () => {
    expect(describeDecision(state({ result: { winners: [] } }), 'seat-0', [endPhase], 'k')).toBeNull();
    expect(describeDecision(state({}), 'seat-0', [], 'k')).toBeNull();
  });

  it('times a pending choice, selection or arrangement as a choice of this state', () => {
    for (const pending of [{ pendingChoice: {} }, { pendingSelection: {} }, { pendingArrangement: {} }]) {
      expect(describeDecision(state(pending), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'choice', seatId: 'seat-1', key: 'step:k7' });
    }
  });

  it('times a pending response as a response of this state', () => {
    expect(describeDecision(state({ pendingResponse: {} }), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'response', seatId: 'seat-1', key: 'step:k7' });
  });

  it('gives each seat one General selection clock', () => {
    expect(describeDecision(state({ phase: 'GeneralSelection' }), 'seat-2', [endPhase], 'k7')).toEqual({ kind: 'selection', seatId: 'seat-2', key: 'selection:seat-2' });
  });

  it('times discards as a discard of this state', () => {
    expect(describeDecision(state({ phase: 'Discard' }), 'seat-0', [discard], 'k7')).toEqual({ kind: 'discard', seatId: 'seat-0', key: 'step:k7' });
  });

  it('keeps one clock for a whole Play phase', () => {
    expect(describeDecision(state({}), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'play', seatId: 'seat-0', key: 'play:3:seat-0' });
    expect(describeDecision(state({}), 'seat-0', [endPhase], 'k8')?.key).toBe('play:3:seat-0');
  });

  it('keeps one choice clock across the reveals of a Start window', () => {
    const window = { turn: { turnNumber: 3, ownerSeatId: 'seat-0', startWindow: true } };
    expect(describeDecision(state({ phase: 'Start', ...window }), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'choice', seatId: 'seat-0', key: 'start:3:seat-0' });
    expect(describeDecision(state({ phase: 'Start', ...window }), 'seat-0', [endPhase], 'k8')?.key).toBe('start:3:seat-0');
  });

  it('falls back to a response clock outside those cases', () => {
    expect(describeDecision(state({ phase: 'Start' }), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'response', seatId: 'seat-0', key: 'step:k7' });
  });
});

describe('switchClock', () => {
  const play: DecisionSpec = { kind: 'play', seatId: 'seat-0', key: 'play:3:seat-0' };
  const response: DecisionSpec = { kind: 'response', seatId: 'seat-1', key: 'step:k9' };

  it('starts a new decision with its full budget', () => {
    const clock = switchClock(EMPTY_CLOCK, play, 1_000);
    expect(clock.running).toEqual({ decision: play, endsAt: 301_000, totalMs: 300_000 });
    expect(clockRemainingMs(clock, 1_000)).toBe(300_000);
  });

  it('keeps the same clock running when the decision keeps its key', () => {
    const started = switchClock(EMPTY_CLOCK, play, 1_000);
    const later = switchClock(started, { ...play, seatId: 'seat-0' }, 50_000);
    expect(later.running?.endsAt).toBe(301_000);
  });

  it('pauses a clock it switches away from and resumes it with the time it had left', () => {
    const started = switchClock(EMPTY_CLOCK, play, 0);
    const answering = switchClock(started, response, 100_000);
    expect(answering.paused).toEqual({ 'play:3:seat-0': 200_000 });
    expect(answering.running?.endsAt).toBe(160_000);
    const back = switchClock(answering, play, 130_000);
    expect(back.running?.endsAt).toBe(330_000);
    expect(back.paused).toEqual({ 'step:k9': 30_000 });
  });

  it('pauses when no decision is open', () => {
    const paused = switchClock(switchClock(EMPTY_CLOCK, play, 0), null, 10_000);
    expect(paused.running).toBeNull();
    expect(paused.paused).toEqual({ 'play:3:seat-0': 290_000 });
    expect(clockRemainingMs(paused, 10_000)).toBeNull();
  });

  it('never reports less than zero', () => {
    expect(clockRemainingMs(switchClock(EMPTY_CLOCK, response, 0), 999_999)).toBe(0);
  });

  it('forgets an expired clock without pausing it', () => {
    const expired = expireClock(switchClock(EMPTY_CLOCK, response, 0));
    expect(expired.running).toBeNull();
    expect(expired.paused).toEqual({});
  });
});
