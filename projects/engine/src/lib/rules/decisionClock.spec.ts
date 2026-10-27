import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { DECISION_SECONDS, DecisionSpec, GAME_START_LEAD_IN_MS, EMPTY_CLOCK, JUDGMENT_LEAD_IN_MS, clockRemainingMs, clockStartsInMs, describeDecision, expireClock, switchClock } from './decisionClock';

const state = (fields: object): GameState =>
  ({ phase: 'Play', turn: { turnNumber: 3, ownerSeatId: 'seat-0' }, result: null, pendingResponse: null, ...fields }) as unknown as GameState;
const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const discard: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' };

describe('describeDecision', () => {
  it('is null when the game is over or the seat has nothing to do', () => {
    expect(describeDecision(state({ result: { winners: [] } }), 'seat-0', [endPhase], 'k')).toBeNull();
    expect(describeDecision(state({}), 'seat-0', [], 'k')).toBeNull();
  });

  it('times a pending ask as an ask, and any other choice or selection as a pick', () => {
    const kindOf = (pending: object) => describeDecision(state(pending), 'seat-1', [endPhase], 'k7')?.kind;
    expect(kindOf({ pendingChoice: { verb: 'use' } })).toBe('ask');
    expect(kindOf({ pendingChoice: { verb: 'take' } })).toBe('pick');
    expect(kindOf({ pendingChoice: { verb: 'pick' } })).toBe('pick');
    expect(kindOf({ pendingSelection: {} })).toBe('pick');
  });

  it('times a pending arrangement as an arrangement of this state', () => {
    expect(describeDecision(state({ pendingArrangement: {} }), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'arrange', seatId: 'seat-1', key: 'step:k7' });
  });

  it('tells a Wuxie, a dying round and any other response apart', () => {
    const kindOf = (reason?: object) => describeDecision(state({ pendingResponse: { reason } }), 'seat-1', [endPhase], 'k7')?.kind;
    expect(kindOf({ kind: 'wuxie' })).toBe('wuxie');
    expect(kindOf({ kind: 'counter-wuxie' })).toBe('wuxie');
    expect(kindOf({ kind: 'dying' })).toBe('dying');
    expect(kindOf({ kind: 'card-effect' })).toBe('response');
    expect(kindOf()).toBe('response');
  });

  it('gives each kind of decision its seconds', () => {
    expect(DECISION_SECONDS).toMatchObject({ wuxie: 15, dying: 20, response: 20, ask: 15, pick: 30, arrange: 60, start: 20, discard: 30, selection: 300, play: 180, judgmentChange: 15, notice: 3 });
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
    expect(describeDecision(state({ phase: 'Start', ...window }), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'start', seatId: 'seat-0', key: 'start:3:seat-0' });
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
    expect(clock.running).toEqual({ decision: play, startsAt: 1_000, endsAt: 181_000, totalMs: 180_000 });
    expect(clockRemainingMs(clock, 1_000)).toBe(180_000);
  });

  it('keeps the same clock running when the decision keeps its key', () => {
    const started = switchClock(EMPTY_CLOCK, play, 1_000);
    const later = switchClock(started, { ...play, seatId: 'seat-0' }, 50_000);
    expect(later.running?.endsAt).toBe(181_000);
  });

  it('pauses a clock it switches away from and resumes it with the time it had left', () => {
    const started = switchClock(EMPTY_CLOCK, play, 0);
    const answering = switchClock(started, response, 100_000);
    expect(answering.paused).toEqual({ 'play:3:seat-0': 80_000 });
    expect(answering.running?.endsAt).toBe(120_000);
    const back = switchClock(answering, play, 110_000);
    expect(back.running?.endsAt).toBe(190_000);
    expect(back.paused).toEqual({ 'step:k9': 10_000 });
  });

  it('pauses when no decision is open', () => {
    const paused = switchClock(switchClock(EMPTY_CLOCK, play, 0), null, 10_000);
    expect(paused.running).toBeNull();
    expect(paused.paused).toEqual({ 'play:3:seat-0': 170_000 });
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
    expect(describeDecision(settled, 'seat-0', [ack], 'k')).toEqual({ kind: 'notice', seatId: 'seat-0', key: 'step:k', leadInMs: 0 });
    expect(DECISION_SECONDS.notice).toBe(3);
  });

  it('gets its own clock for each judgment', () => {
    expect(describeDecision(settled, 'seat-0', [ack], 'k1')!.key).not.toBe(describeDecision(settled, 'seat-0', [ack], 'k2')!.key);
  });
});

describe('the judgment-change clock', () => {
  it('is 10 seconds', () => {
    expect(DECISION_SECONDS.judgmentChange).toBe(15);
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

describe('describeDecision around a judgment', () => {
  const ack: Action = { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0' };
  const unsettled = (rounds: number, pending: object) => state({ judgmentView: { settled: false, rounds }, phase: 'Play', ...pending });
  // The callers that play the animation (a person at the table) ask for the lead-in.
  const withLeadIn = { leadIn: true };

  it('times a flagged ask under an unsettled judgment as a judgment change, for 10 seconds', () => {
    const decision = describeDecision(unsettled(1, { pendingChoice: { judgmentChange: true } }), 'seat-1', [endPhase], 'k7', withLeadIn);
    expect(decision).toEqual({ kind: 'judgmentChange', seatId: 'seat-1', key: 'judgmentChange:1', leadInMs: JUDGMENT_LEAD_IN_MS.head });
  });

  it('keeps one clock for the ask and the card pick that follows it', () => {
    const ask = describeDecision(unsettled(1, { pendingChoice: { judgmentChange: true } }), 'seat-1', [endPhase], 'k7', withLeadIn);
    const pick = describeDecision(unsettled(1, { pendingSelection: { judgmentChange: true } }), 'seat-1', [endPhase], 'k8', withLeadIn);
    expect(pick?.key).toBe(ask?.key);
  });

  it('gives each later ask its own clock with the replacement lead-in', () => {
    const second = describeDecision(unsettled(2, { pendingChoice: { judgmentChange: true } }), 'seat-2', [endPhase], 'k9', withLeadIn);
    expect(second).toEqual({ kind: 'judgmentChange', seatId: 'seat-2', key: 'judgmentChange:2', leadInMs: JUDGMENT_LEAD_IN_MS.replace });
  });

  it('has no lead-in unless asked for it, as in a game with no person playing', () => {
    expect(describeDecision(unsettled(1, { pendingChoice: { judgmentChange: true } }), 'seat-1', [endPhase], 'k7')?.leadInMs).toBe(0);
    expect(describeDecision(state({ judgmentView: { settled: true, rounds: 0 } }), 'seat-0', [ack], 'k', { leadIn: false })?.leadInMs).toBe(0);
  });

  it('keeps the pick kind for an unflagged choice under an unsettled judgment', () => {
    expect(describeDecision(unsettled(1, { pendingChoice: { verb: 'pick' } }), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'pick', seatId: 'seat-1', key: 'step:k7' });
  });

  it('gives a settled judgment the tail lead-in, plus the head when no changer was ever asked', () => {
    expect(describeDecision(state({ judgmentView: { settled: true, rounds: 0 } }), 'seat-0', [ack], 'k', withLeadIn)?.leadInMs).toBe(JUDGMENT_LEAD_IN_MS.head + JUDGMENT_LEAD_IN_MS.tail);
    expect(describeDecision(state({ judgmentView: { settled: true, rounds: 2 } }), 'seat-0', [ack], 'k', withLeadIn)?.leadInMs).toBe(JUDGMENT_LEAD_IN_MS.tail);
  });
});

describe('GAME_START_LEAD_IN_MS', () => {
  it('is 3 seconds', () => {
    expect(GAME_START_LEAD_IN_MS).toBe(3000);
  });
});
