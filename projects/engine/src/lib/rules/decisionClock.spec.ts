import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { DECISION_SECONDS, DecisionSpec, EMPTY_CLOCK, JUDGMENT_LEAD_IN_MS, clockRemainingMs, clockStartsInMs, describeDecision, expireClock, switchClock } from './decisionClock';

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
    expect(clock.running).toEqual({ decision: play, startsAt: 1_000, endsAt: 301_000, totalMs: 300_000 });
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

describe('a settled judgment', () => {
  const ack: Action = { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0' };
  const settled = state({ judgmentView: { settled: true }, phase: 'Play' });

  it('is a notice decision of 3 seconds', () => {
    expect(describeDecision(settled, 'seat-0', [ack], 'k')).toEqual({ kind: 'notice', seatId: 'seat-0', key: 'step:k' });
    expect(DECISION_SECONDS.notice).toBe(3);
  });

  it('gets its own clock for each judgment', () => {
    expect(describeDecision(settled, 'seat-0', [ack], 'k1')!.key).not.toBe(describeDecision(settled, 'seat-0', [ack], 'k2')!.key);
  });
});

describe('the judgment-change clock', () => {
  it('is 10 seconds', () => {
    expect(DECISION_SECONDS.judgmentChange).toBe(10);
  });

  it('shares its lead-in constants with the app and the server', () => {
    expect(JUDGMENT_LEAD_IN_MS).toEqual({ head: 2100, replace: 1300, tail: 2000 });
  });
});

describe('a clock lead-in', () => {
  const notice: DecisionSpec = { kind: 'notice', seatId: 'seat-0', key: 'step:j1', leadInMs: 2_000 };

  it('starts a new clock at now plus the lead-in and ends a full total later', () => {
    const clock = switchClock(EMPTY_CLOCK, notice, 1_000);
    expect(clock.running?.startsAt).toBe(3_000);
    expect(clock.running?.endsAt).toBe(6_000);
    expect(clock.running?.totalMs).toBe(3_000);
  });

  it('reports the full total while the lead-in plays, then counts down', () => {
    const clock = switchClock(EMPTY_CLOCK, notice, 1_000);
    expect(clockRemainingMs(clock, 1_000)).toBe(3_000);
    expect(clockRemainingMs(clock, 2_999)).toBe(3_000);
    expect(clockRemainingMs(clock, 4_000)).toBe(2_000);
    expect(clockRemainingMs(clock, 99_000)).toBe(0);
  });

  it('says how long until the countdown starts, and 0 once it has', () => {
    const clock = switchClock(EMPTY_CLOCK, notice, 1_000);
    expect(clockStartsInMs(clock, 1_000)).toBe(2_000);
    expect(clockStartsInMs(clock, 2_500)).toBe(500);
    expect(clockStartsInMs(clock, 3_000)).toBe(0);
    expect(clockStartsInMs(EMPTY_CLOCK, 1_000)).toBeNull();
  });

  it('gives a clock resumed from paused no lead-in', () => {
    const other: DecisionSpec = { kind: 'response', seatId: 'seat-1', key: 'step:k9' };
    const started = switchClock(EMPTY_CLOCK, notice, 0);
    const away = switchClock(started, other, 3_500);
    expect(away.paused).toEqual({ 'step:j1': 1_500 });
    const back = switchClock(away, notice, 10_000);
    expect(back.running?.startsAt).toBe(10_000);
    expect(back.running?.endsAt).toBe(11_500);
  });

  it('keeps the same clock, lead-in included, when the key stays', () => {
    const started = switchClock(EMPTY_CLOCK, notice, 1_000);
    const later = switchClock(started, { ...notice }, 2_000);
    expect(later.running?.startsAt).toBe(3_000);
    expect(later.running?.endsAt).toBe(6_000);
  });
});
