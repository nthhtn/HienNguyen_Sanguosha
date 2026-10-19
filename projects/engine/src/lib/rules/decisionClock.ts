import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Seconds per kind of decision.
export const DECISION_SECONDS = {
  response: 60,
  choice: 60,
  discard: 60,
  selection: 300,
  // One budget for a whole Play phase, paused while a response is under way.
  play: 300,
} as const;

export type DecisionKind = keyof typeof DECISION_SECONDS;

// A decision a seat must make. Same key = same clock: a Play phase keeps one
// key across its actions, and General selection one per seat.
export interface DecisionSpec {
  kind: DecisionKind;
  seatId: string;
  key: string;
}

// What `seatId` must decide in `state`, or null. `stepKey` names this exact
// state for the decisions that get a clock each (the caller picks it: the app
// a per-state key, a server the action count).
export function describeDecision(state: GameState, seatId: string, legal: readonly Action[], stepKey: string): DecisionSpec | null {
  if (state.result || legal.length === 0) return null;
  const step = (kind: DecisionKind): DecisionSpec => ({ kind, seatId, key: `step:${stepKey}` });
  if (state.pendingChoice || state.pendingSelection || state.pendingArrangement) return step('choice');
  if (state.pendingResponse) return step('response');
  if (state.phase === 'GeneralSelection') return { kind: 'selection', seatId, key: `selection:${seatId}` };
  // The Start window keeps one clock across its reveals; at zero: Continue.
  if (state.phase === 'Start' && state.turn.startWindow) return { kind: 'choice', seatId, key: `start:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
  if (legal.some((a) => a.kind === 'DiscardCardAction')) return step('discard');
  if (state.phase === 'Play') return { kind: 'play', seatId, key: `play:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
  return step('response');
}

export interface RunningClock {
  decision: DecisionSpec;
  endsAt: number;
  totalMs: number;
}

// The running clock, and the time left on paused ones by key. Plain data:
// callers pass the time, so this holds no timers.
export interface ClockState {
  running: RunningClock | null;
  paused: Readonly<Record<string, number>>;
}

export const EMPTY_CLOCK: ClockState = { running: null, paused: {} };

// Moves the clock to `decision` (null: none open) at time `now`. The same key
// keeps running; any other running clock pauses with what it had left, and a
// paused clock resumes with what it had left.
export function switchClock(clock: ClockState, decision: DecisionSpec | null, now: number): ClockState {
  const running = clock.running;
  if (decision && running && decision.key === running.decision.key) return { ...clock, running: { ...running, decision } };
  const paused: Record<string, number> = { ...clock.paused };
  if (running) paused[running.decision.key] = Math.max(0, running.endsAt - now);
  if (!decision) return { running: null, paused };
  const totalMs = DECISION_SECONDS[decision.kind] * 1000;
  const remainingMs = paused[decision.key] ?? totalMs;
  delete paused[decision.key];
  return { running: { decision, endsAt: now + remainingMs, totalMs }, paused };
}

export function clockRemainingMs(clock: ClockState, now: number): number | null {
  return clock.running ? Math.max(0, clock.running.endsAt - now) : null;
}

// The running clock ran out: it is done, not paused.
export function expireClock(clock: ClockState): ClockState {
  return { ...clock, running: null };
}
