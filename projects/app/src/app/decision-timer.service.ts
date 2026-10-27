import { DestroyRef, Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Action, ClockState, DecisionSpec, EMPTY_CLOCK, GameState, clockRemainingMs, clockStartsInMs, defaultActionsFor, describeDecision, expireClock, switchClock } from 'engine';
import { GameService } from './game.service';

interface Decision {
  spec: DecisionSpec;
  state: GameState;
}

// Times every decision a person makes. The clock runs only while a game board
// is on screen and the deciding seat's view is showing (in pass-and-play,
// after the hand-off gate); bots are never timed. The engine says which clock
// a decision runs on and how long it has (describeDecision, switchClock):
//   - Responses, choices and discards: a clock per decision.
//   - General selection: one clock per player for their whole choice.
//   - The Play phase: one clock for the phase.
// Any clock pauses whenever its decision isn't on screen (a response under
// way, the pass-and-play gate, the board left for another page) and resumes
// with the time it had left.
// At zero the timer submits the UI's current pick if it gave one, else the
// engine's default (defaultActionsFor).
@Injectable({ providedIn: 'root' })
export class DecisionTimer {
  private readonly game = inject(GameService);
  private readonly boards = signal(0);
  private interval: ReturnType<typeof setInterval> | null = null;
  private clock: ClockState = EMPTY_CLOCK;
  // The state the running clock is for: a timeout acts only if it still is.
  private clockState: GameState | null = null;
  private choice: { state: GameState; actions: Action[] } | null = null;
  private stateKeys = new WeakMap<GameState, string>();
  private nextKey = 0;

  private readonly _secondsLeft = signal<number | null>(null);
  private readonly _totalSeconds = signal<number | null>(null);
  // Whole seconds left on the current decision, or null when nothing is timed.
  readonly secondsLeft: Signal<number | null> = this._secondsLeft.asReadonly();
  // The current clock's full length, for the countdown bar.
  readonly totalSeconds: Signal<number | null> = this._totalSeconds.asReadonly();
  private readonly _startsInMs = signal<number | null>(null);
  // Milliseconds until the countdown starts: a decision that follows an animation waits for it to play
  // (a judgment's card turning up, its verdict). 0 once it has; null when nothing is timed.
  readonly startsInMs: Signal<number | null> = this._startsInMs.asReadonly();

  // What a person must decide now, or null.
  private readonly decision = computed<Decision | null>(() => {
    if (this.boards() === 0) return null;
    const state = this.game.state();
    const seatId = this.game.activeSeatId();
    if (!state || !seatId) return null;
    // Behind the gate, or a bot to move; a settled judgment is public, so it is clocked behind the gate too.
    if (this.game.revealedSeatId() !== seatId && !state.judgmentView?.settled) return null;
    // A local game always has a person at the table, so the judgment animation is played for them.
    const spec = describeDecision(state, seatId, this.game.legalActions(), this.keyOf(state), { leadIn: true });
    // Keys are per game, so nothing paused in one game resumes in the next.
    return spec && { spec: { ...spec, key: `${this.game.gameNumber()}:${spec.key}` }, state };
  });

  constructor() {
    // A new game: nothing paused carries over.
    effect(() => {
      this.game.gameNumber();
      untracked(() => (this.clock = { ...this.clock, paused: {} }));
    });
    effect(() => {
      const decision = this.decision();
      untracked(() => this.switchTo(decision));
    });
    inject(DestroyRef).onDestroy(() => this.stopTicking());
  }

  // A game board registers while it is on screen; the clock pauses otherwise.
  attach(destroyRef: DestroyRef): void {
    this.boards.update((n) => n + 1);
    destroyRef.onDestroy(() => this.boards.update((n) => n - 1));
  }

  // What to submit if time runs out on this very state (e.g. the cards ticked
  // so far in the Discard dialog). Ignored once the state has moved on.
  setTimeoutChoice(actions: Action[]): void {
    const state = this.game.state();
    this.choice = state ? { state, actions } : null;
  }

  private keyOf(state: GameState): string {
    let key = this.stateKeys.get(state);
    if (!key) {
      key = `decision:${this.nextKey++}`;
      this.stateKeys.set(state, key);
    }
    return key;
  }

  private switchTo(decision: Decision | null): void {
    const sameClock = !!decision && this.clock.running?.decision.key === decision.spec.key;
    this.clock = switchClock(this.clock, decision?.spec ?? null, Date.now());
    this.clockState = decision?.state ?? null;
    // Same Play phase, new state (a card played): the clock just keeps going.
    if (sameClock) return;
    this.stopTicking();
    const running = this.clock.running;
    if (!running) {
      this._secondsLeft.set(null);
      this._totalSeconds.set(null);
      this._startsInMs.set(null);
      return;
    }
    this._totalSeconds.set(running.totalMs / 1000);
    this._secondsLeft.set(Math.ceil((clockRemainingMs(this.clock, Date.now()) ?? 0) / 1000));
    this._startsInMs.set(clockStartsInMs(this.clock, Date.now()));
    this.interval = setInterval(() => this.tick(), 250);
  }

  private tick(): void {
    const leftMs = clockRemainingMs(this.clock, Date.now());
    if (leftMs === null) return;
    const left = Math.ceil(leftMs / 1000);
    this._secondsLeft.set(left);
    this._startsInMs.set(clockStartsInMs(this.clock, Date.now()));
    if (left > 0) return;
    this.stopTicking();
    this.clock = expireClock(this.clock);
    const state = this.clockState;
    if (!state || this.game.state() !== state) return;
    const chosen = this.choice?.state === state ? this.choice.actions : null;
    this.game.submitAll(chosen ?? defaultActionsFor(state, this.game.legalActions()));
  }

  private stopTicking(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
