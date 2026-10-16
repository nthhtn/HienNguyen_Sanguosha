import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  Action,
  ContentRegistry,
  Effect,
  EngineContext,
  GameRules,
  GameState,
  createGame,
  getActiveSeatId,
  getLegalActions,
  previewEffect,
  redactStateForSeat,
  resolve,
} from 'engine';
import { buildContentRegistry, kingdomWarMaxSeats, kingdomWarMode } from 'content';
import type { Msg } from './i18n/msg';
import { BotTurnMemory, ruleBasedPolicy } from 'bots';

export type GameMode = 'vs-bots' | 'pass-and-play';

// In vs-bots mode the one human always plays this seat.
export const HUMAN_SEAT_ID = 'seat-0';

// The engine's own error text is developer English and the engine never sees a
// locale, so the banner says something went wrong in the player's language and
// keeps the engine's text as the detail.
function engineError(err: unknown): Msg {
  return { key: 'error.internal', detail: err instanceof Error ? err.message : String(err) };
}

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: kingdomWarMode };

  readonly maxSeats: number = kingdomWarMaxSeats(this.registry);

  // Delay before each bot move, so a human can follow along. Tests set 0.
  botDelayMs = 1500;

  private readonly _state: WritableSignal<GameState | null> = signal(null);
  private readonly _revealedSeatId: WritableSignal<string | null> = signal(null);
  private readonly _lastError: WritableSignal<Msg | null> = signal(null);
  private readonly _mode: WritableSignal<GameMode> = signal('pass-and-play');
  private readonly _botThinkingSeatId: WritableSignal<string | null> = signal(null);
  private readonly _gameNumber: WritableSignal<number> = signal(0);

  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly botMemories = new Map<string, BotTurnMemory>();

  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly revealedSeatId: Signal<string | null> = this._revealedSeatId.asReadonly();
  readonly lastError: Signal<Msg | null> = this._lastError.asReadonly();
  readonly mode: Signal<GameMode> = this._mode.asReadonly();
  readonly botThinkingSeatId: Signal<string | null> = this._botThinkingSeatId.asReadonly();
  // Counts games started, so per-game bookkeeping (e.g. clocks) can't leak into the next.
  readonly gameNumber: Signal<number> = this._gameNumber.asReadonly();

  readonly humanSeatId: Signal<string | null> = computed(() => (this._mode() === 'vs-bots' ? HUMAN_SEAT_ID : null));

  readonly botSeatIds: Signal<string[]> = computed(
    () => this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []
  );

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

  // A pending effect as it would really land (before-triggers applied), for
  // what the UI tells the player. The engine decides; the UI only reads it.
  previewEffect(state: GameState, effect: Effect): Effect | null {
    return previewEffect(state, effect, this.ctx);
  }

  // Only the human's moves are offered to the UI; bots decide for themselves.
  readonly legalActions: Signal<Action[]> = computed(() => {
    const state = this._state();
    const seatId = this.activeSeatId();
    if (!state || !seatId || this.botSeatIds().includes(seatId)) return [];
    return getLegalActions(state, seatId, this.registry);
  });

  readonly visibleState: Signal<GameState | null> = computed(() => {
    const state = this._state();
    const seatId = this._revealedSeatId();
    if (!state || !seatId) return null;
    return redactStateForSeat(state, seatId);
  });

  // `names[i]` names seat i; a blank or missing name keeps the mode's default ("Seat i").
  startGame(seatCount: number, seed?: number, mode: GameMode = 'pass-and-play', names: string[] = [], rules?: GameRules): void {
    this.cancelBotTimer();
    this.botMemories.clear();
    this._mode.set(mode);
    this._gameNumber.update((n) => n + 1);
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    try {
      const created = createGame(kingdomWarMode, this.registry, seatIds, rngSeed, rules);
      const players = created.players.map((p, i) => ({
        ...p,
        kind: mode === 'vs-bots' && p.seatId !== HUMAN_SEAT_ID ? ('bot' as const) : ('human' as const),
        name: names[i]?.trim() || p.name,
      }));
      this._state.set({ ...created, players });
      this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
    } catch (err) {
      this._state.set(null);
      this._revealedSeatId.set(null);
      this._lastError.set(engineError(err));
    }
    this.scheduleBotIfDue();
  }

  reveal(seatId: string): void {
    this._revealedSeatId.set(seatId);
  }

  submit(action: Action): void {
    // A bot seat's moves come only from its own timer, never from the UI.
    const activeSeatId = this.activeSeatId();
    if (activeSeatId && this.botSeatIds().includes(activeSeatId)) return;
    if (this.apply(action)) this.scheduleBotIfDue();
  }

  // Resolves several actions as one move (e.g. a whole Discard phase): the
  // view is gated once afterwards, not between them. Stops at the first error.
  submitAll(actions: Action[]): void {
    const activeSeatId = this.activeSeatId();
    if (activeSeatId && this.botSeatIds().includes(activeSeatId)) return;
    for (const action of actions) {
      if (!this.apply(action, false)) break;
    }
    this._revealedSeatId.set(this.humanSeatId());
    this.scheduleBotIfDue();
  }

  clearError(): void {
    this._lastError.set(null);
  }

  // Resolves one action; on success the next view is gated again in
  // pass-and-play, and stays on the human's seat in vs-bots.
  private apply(action: Action, regate = true): boolean {
    const state = this._state();
    if (!state) return false;
    try {
      this._state.set(resolve(state, action, this.ctx).state);
      if (regate) this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
      return true;
    } catch (err) {
      this._lastError.set(engineError(err));
      return false;
    }
  }

  private scheduleBotIfDue(): void {
    this.cancelBotTimer();
    const state = this._state();
    const seatId = state && !state.result ? getActiveSeatId(state) : null;
    if (!seatId || !this.botSeatIds().includes(seatId)) {
      this._botThinkingSeatId.set(null);
      return;
    }
    this._botThinkingSeatId.set(seatId);
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.runBot(seatId);
    }, this.botDelayMs);
  }

  private runBot(seatId: string): void {
    const state = this._state();
    if (!state) return;
    let action: Action;
    try {
      const legal = getLegalActions(state, seatId, this.registry);
      const decision = ruleBasedPolicy.decide(
        redactStateForSeat(state, seatId),
        seatId,
        legal,
        this.registry,
        this.botMemories.get(seatId) ?? null
      );
      this.botMemories.set(seatId, decision.memory);
      action = decision.action;
    } catch (err) {
      this._lastError.set(engineError(err));
      this._botThinkingSeatId.set(null);
      return;
    }
    if (this.apply(action)) this.scheduleBotIfDue();
    else this._botThinkingSeatId.set(null);
  }

  private cancelBotTimer(): void {
    if (this.botTimer !== null) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }
}
