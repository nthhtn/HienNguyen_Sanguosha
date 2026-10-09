import { DestroyRef, Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Action, GameState, discardOwed } from 'engine';
import { GameService } from './game.service';

// Seconds per kind of decision.
export const DECISION_SECONDS = {
  response: 60,
  choice: 60,
  discard: 60,
  selection: 300,
  // One budget for a whole Play phase, paused while a response is under way.
  play: 300,
} as const;

type DecisionKind = keyof typeof DECISION_SECONDS;

interface Decision {
  kind: DecisionKind;
  state: GameState;
  // Same key = same clock. A Play phase keeps one key across its actions, and
  // general selection one per player for their whole choice.
  key: string;
}

// Times every decision a person makes. The clock runs only while a game board
// is on screen and the deciding seat's view is showing (in pass-and-play,
// after the hand-off gate); bots are never timed.
//   - Responses, choices and discards: a clock per decision.
//   - General selection: one clock per player for their whole choice.
//   - The Play phase: one clock for the phase.
// Any clock pauses whenever its decision isn't on screen (a response under
// way, the pass-and-play gate, the board left for another page) and resumes
// with the time it had left.
// At zero the timer submits an engine-legal default: a response → No Response
// (Pass); a choice → the UI's current pick if it gave one, else the first
// option; the Play phase → End Phase; the Discard phase → the UI's current
// choice if it gave one, else the first cards in hand; general selection →
// the first legal pair.
@Injectable({ providedIn: 'root' })
export class DecisionTimer {
  private readonly game = inject(GameService);
  private readonly boards = signal(0);
  private interval: ReturnType<typeof setInterval> | null = null;
  private current: { decision: Decision; endsAt: number } | null = null;
  // Time left on paused clocks, by decision key.
  private readonly paused = new Map<string, number>();
  private choice: { state: GameState; actions: Action[] } | null = null;
  private stateKeys = new WeakMap<GameState, string>();
  private nextKey = 0;

  private readonly _secondsLeft = signal<number | null>(null);
  private readonly _totalSeconds = signal<number | null>(null);
  // Whole seconds left on the current decision, or null when nothing is timed.
  readonly secondsLeft: Signal<number | null> = this._secondsLeft.asReadonly();
  // The current clock's full length, for the countdown bar.
  readonly totalSeconds: Signal<number | null> = this._totalSeconds.asReadonly();

  // What a person must decide now, or null.
  private readonly decision = computed<Decision | null>(() => {
    if (this.boards() === 0) return null;
    const state = this.game.state();
    const seatId = this.game.activeSeatId();
    if (!state || state.result || !seatId) return null;
    if (this.game.revealedSeatId() !== seatId) return null; // behind the gate, or a bot to move
    const legal = this.game.legalActions();
    if (legal.length === 0) return null;
    const game = this.game.gameNumber();
    if (state.pendingChoice || state.pendingSelection || state.pendingArrangement) return { kind: 'choice', state, key: this.keyOf(state) };
    if (state.pendingResponse) return { kind: 'response', state, key: this.keyOf(state) };
    if (state.phase === 'GeneralSelection') return { kind: 'selection', state, key: `${game}:selection:${seatId}` };
    if (legal.some((a) => a.kind === 'DiscardCardAction')) return { kind: 'discard', state, key: this.keyOf(state) };
    if (state.phase === 'Play') return { kind: 'play', state, key: `${game}:play:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
    return { kind: 'response', state, key: this.keyOf(state) };
  });

  constructor() {
    // A new game: nothing paused carries over.
    effect(() => {
      this.game.gameNumber();
      untracked(() => this.paused.clear());
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
    const previous = this.current?.decision;
    // Same Play phase, new state (a card played): the clock just keeps going.
    if (decision && previous && decision.key === previous.key) {
      this.current = { decision, endsAt: this.current!.endsAt };
      return;
    }
    this.pauseCurrent();
    if (!decision) {
      this._secondsLeft.set(null);
      this._totalSeconds.set(null);
      return;
    }
    const total = DECISION_SECONDS[decision.kind];
    const remainingMs = this.paused.get(decision.key) ?? total * 1000;
    this.paused.delete(decision.key);
    this.current = { decision, endsAt: Date.now() + remainingMs };
    this._totalSeconds.set(total);
    this._secondsLeft.set(Math.ceil(remainingMs / 1000));
    this.interval = setInterval(() => this.tick(), 250);
  }

  // Stops the running clock, keeping what it had left for when it resumes.
  private pauseCurrent(): void {
    this.stopTicking();
    const running = this.current;
    this.current = null;
    if (running) this.paused.set(running.decision.key, Math.max(0, running.endsAt - Date.now()));
  }

  private tick(): void {
    const running = this.current;
    if (!running) return;
    const left = Math.max(0, Math.ceil((running.endsAt - Date.now()) / 1000));
    this._secondsLeft.set(left);
    if (left > 0) return;
    this.stopTicking();
    this.current = null;
    const { state } = running.decision;
    if (this.game.state() !== state) return;
    const chosen = this.choice?.state === state ? this.choice.actions : null;
    this.game.submitAll(chosen ?? defaultDecision(state, this.game.legalActions()));
  }

  private stopTicking(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// What a timeout submits when the UI hasn't said: Cancel or the first picks
// for a selection, every card on top for an arrangement, Don't for an ask, the
// first option of a choice, No Response, the first General pair, the first
// discards, else End Phase.
export function defaultDecision(state: GameState, legal: readonly Action[]): Action[] {
  const arrange = legal.find((a): a is Extract<Action, { kind: 'ArrangeCardsAction' }> => a.kind === 'ArrangeCardsAction');
  if (arrange && state.pendingArrangement) return [{ ...arrange, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }];
  // A selection: Cancel when it may be, else the first eligible picks.
  const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
  if (cancel) return [cancel];
  const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
  if (select && state.pendingSelection) return [{ ...select, ids: state.pendingSelection.eligibleIds.slice(0, state.pendingSelection.min) }];
  // An ask (or "let them draw"): Don't.
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (decline) return [decline];
  const pick = legal.find((a) => a.kind === 'ChooseOptionAction');
  if (pick) return [pick];
  const pass = legal.find((a) => a.kind === 'PassAction');
  if (pass) return [pass];
  const generals = legal.find((a) => a.kind === 'ChooseGeneralsAction');
  if (generals) return [generals];
  const discards = legal.filter((a) => a.kind === 'DiscardCardAction');
  if (discards.length > 0) return discards.slice(0, discardOwed(state, state.turn.ownerSeatId));
  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  return [endPhase ?? legal[0]];
}
