import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  Action,
  ContentRegistry,
  EngineContext,
  GameState,
  createGame,
  getActiveSeatId,
  getLegalActions,
  redactStateForSeat,
  resolve,
} from 'engine';
import { buildContentRegistry, kingdomWarMaxSeats, kingdomWarMode } from 'content';
import { BotTurnMemory, ruleBasedPolicy } from 'bots';

export type GameMode = 'vs-bots' | 'pass-and-play';

// In vs-bots mode the one human always plays this seat.
export const HUMAN_SEAT_ID = 'seat-0';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: kingdomWarMode };

  readonly maxSeats: number = kingdomWarMaxSeats(this.registry);

  // Delay before each bot move, so a human can follow along. Tests set 0.
  botDelayMs = 700;

  private readonly _state: WritableSignal<GameState | null> = signal(null);
  private readonly _revealedSeatId: WritableSignal<string | null> = signal(null);
  private readonly _lastError: WritableSignal<string | null> = signal(null);
  private readonly _mode: WritableSignal<GameMode> = signal('pass-and-play');
  private readonly _botThinkingSeatId: WritableSignal<string | null> = signal(null);

  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly botMemories = new Map<string, BotTurnMemory>();

  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly revealedSeatId: Signal<string | null> = this._revealedSeatId.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();
  readonly mode: Signal<GameMode> = this._mode.asReadonly();
  readonly botThinkingSeatId: Signal<string | null> = this._botThinkingSeatId.asReadonly();

  readonly humanSeatId: Signal<string | null> = computed(() => (this._mode() === 'vs-bots' ? HUMAN_SEAT_ID : null));

  readonly botSeatIds: Signal<string[]> = computed(
    () => this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []
  );

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

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

  startGame(seatCount: number, seed?: number, mode: GameMode = 'pass-and-play'): void {
    this.cancelBotTimer();
    this.botMemories.clear();
    this._mode.set(mode);
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    try {
      const created = createGame(kingdomWarMode, this.registry, seatIds, rngSeed);
      const players = created.players.map((p) => ({
        ...p,
        kind: mode === 'vs-bots' && p.seatId !== HUMAN_SEAT_ID ? ('bot' as const) : ('human' as const),
      }));
      this._state.set({ ...created, players });
      this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
    } catch (err) {
      this._state.set(null);
      this._revealedSeatId.set(null);
      this._lastError.set(errorMessage(err));
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

  clearError(): void {
    this._lastError.set(null);
  }

  // Resolves one action; on success the next view is gated again in
  // pass-and-play, and stays on the human's seat in vs-bots.
  private apply(action: Action): boolean {
    const state = this._state();
    if (!state) return false;
    try {
      this._state.set(resolve(state, action, this.ctx).state);
      this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
      return true;
    } catch (err) {
      this._lastError.set(errorMessage(err));
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
      this._lastError.set(errorMessage(err));
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
