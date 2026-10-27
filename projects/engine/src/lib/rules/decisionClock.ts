import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Seconds per kind of decision.
export const DECISION_SECONDS = {
  // Answering a Wuxie, or a Wuxie played against one: a yes or no that every seat in the chain waits on.
  wuxie: 15,
  // The dying round's Peach.
  dying: 20,
  // Any other response window: a Shan, a Sha for a Duel, Barbarians or Coerce, a skill's response.
  response: 20,
  // A skill's use-it-or-not ask.
  ask: 15,
  // A pick that takes thought: a card (Steal, Break, Harvest, Compete), a seat, a suit, who gets cards.
  pick: 30,
  // Putting cards back in order (Astrology).
  arrange: 60,
  // The Start window's reveal.
  start: 20,
  discard: 30,
  selection: 300,
  // A settled judgment, for anyone to read and close: the countdown after its animation.
  notice: 3,
  // A skill's decision whether to change a judgment's card.
  judgmentChange: 15,
  // One budget for a whole Play phase, paused while a response is under way.
  play: 180,
} as const;

export type DecisionKind = keyof typeof DECISION_SECONDS;

// How long the judgment popup's animation takes before a clock may start, so a clock runs only
// while what it times is on screen. `head`: source, rule and the card turning up. `replace`: a
// replacement's swap. `tail`: verdict and consequence. Read by the app and by the server.
export const JUDGMENT_LEAD_IN_MS = { head: 2100, replace: 1300, tail: 2000 } as const;

// How long the first decision of a game waits after the last seat has chosen its Generals, so the
// players see "Game starts in 3" first. Read by the app and by the server.
export const GAME_START_LEAD_IN_MS = 3000;

// A decision a seat must make. Same key = same clock: a Play phase keeps one
// key across its actions, and General selection one per seat.
export interface DecisionSpec {
  kind: DecisionKind;
  seatId: string;
  key: string;
  // Milliseconds an animation must play before this decision's countdown starts. Applies only
  // when the clock is new: a clock resumed from paused has none.
  leadInMs?: number;
}

// What `seatId` must decide in `state`, or null. `stepKey` names this exact
// state for the decisions that get a clock each (the caller picks it: the app
// a per-state key, a server the action count).
export function describeDecision(state: GameState, seatId: string, legal: readonly Action[], stepKey: string, opts: { leadIn?: boolean } = {}): DecisionSpec | null {
  if (state.result || legal.length === 0) return null;
  const step = (kind: DecisionKind): DecisionSpec => ({ kind, seatId, key: `step:${stepKey}` });
  const view = state.judgmentView;
  // Only a caller with a person at the table asks for the lead-in; a headless game plays no animation.
  const leadIn = (ms: number): number => (opts.leadIn === true ? ms : 0);
  const rounds = view?.rounds ?? 0;
  // A settled judgment closes on its own countdown, once the verdict and consequence have played
  // (and the card's first showing, if no skill was asked, which would have covered it).
  if (view?.settled) return { ...step('notice'), leadInMs: leadIn(JUDGMENT_LEAD_IN_MS.tail + (rounds === 0 ? JUDGMENT_LEAD_IN_MS.head : 0)) };
  // A skill that may change the card asks: one clock for the ask and the pick after it, started once
  // the animation before it (the card turning up, or the last replacement) has played.
  if (view && (state.pendingChoice?.judgmentChange || state.pendingSelection?.judgmentChange)) {
    return { kind: 'judgmentChange', seatId, key: `judgmentChange:${rounds}`, leadInMs: leadIn(rounds <= 1 ? JUDGMENT_LEAD_IN_MS.head : JUDGMENT_LEAD_IN_MS.replace) };
  }
  if (state.pendingArrangement) return step('arrange');
  if (state.pendingChoice) return step(state.pendingChoice.verb === 'use' ? 'ask' : 'pick');
  if (state.pendingSelection) return step('pick');
  if (state.pendingResponse) {
    const reason = state.pendingResponse.reason?.kind;
    return step(reason === 'wuxie' || reason === 'counter-wuxie' ? 'wuxie' : reason === 'dying' ? 'dying' : 'response');
  }
  if (state.phase === 'GeneralSelection') return { kind: 'selection', seatId, key: `selection:${seatId}` };
  // The Start window has one clock; at zero it confirms with nothing revealed.
  if (state.phase === 'Start' && state.turn.startWindow) return { kind: 'start', seatId, key: `start:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
  if (legal.some((a) => a.kind === 'DiscardCardAction')) return step('discard');
  if (state.phase === 'Play') return { kind: 'play', seatId, key: `play:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
  return step('response');
}

export interface RunningClock {
  decision: DecisionSpec;
  // When the countdown starts (after any lead-in) and when it ends: `endsAt - startsAt` is the time left at the start.
  startsAt: number;
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
  if (running) paused[running.decision.key] = clockRemainingMs(clock, now) ?? 0;
  if (!decision) return { running: null, paused };
  const totalMs = DECISION_SECONDS[decision.kind] * 1000;
  const resumed = paused[decision.key];
  delete paused[decision.key];
  // A resumed clock has nothing left to wait for; a new one waits out its lead-in.
  const startsAt = now + (resumed === undefined ? (decision.leadInMs ?? 0) : 0);
  return { running: { decision, startsAt, endsAt: startsAt + (resumed ?? totalMs), totalMs }, paused };
}

// The time left on the countdown: the full budget while the lead-in plays, never less than zero.
export function clockRemainingMs(clock: ClockState, now: number): number | null {
  const running = clock.running;
  return running ? Math.min(running.totalMs, Math.max(0, running.endsAt - now)) : null;
}

// Milliseconds until the countdown starts, 0 once it has, null with no clock.
export function clockStartsInMs(clock: ClockState, now: number): number | null {
  return clock.running ? Math.max(0, clock.running.startsAt - now) : null;
}

// The running clock ran out: it is done, not paused.
export function expireClock(clock: ClockState): ClockState {
  return { ...clock, running: null };
}
