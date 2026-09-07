import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  Action,
  ContentRegistry,
  EngineContext,
  GameState,
  createGame,
  getLegalActions,
  redactStateForSeat,
  resolve,
} from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: kingdomWarMode };

  private readonly _state: WritableSignal<GameState | null> = signal(null);
  private readonly _revealedSeatId: WritableSignal<string | null> = signal(null);
  private readonly _lastError: WritableSignal<string | null> = signal(null);

  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly revealedSeatId: Signal<string | null> = this._revealedSeatId.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    if (!state) return null;
    return state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
  });

  readonly legalActions: Signal<Action[]> = computed(() => {
    const state = this._state();
    const seatId = this.activeSeatId();
    if (!state || !seatId) return [];
    return getLegalActions(state, seatId);
  });

  readonly visibleState: Signal<GameState | null> = computed(() => {
    const state = this._state();
    const seatId = this._revealedSeatId();
    if (!state || !seatId) return null;
    return redactStateForSeat(state, seatId);
  });

  startGame(seatCount: number, seed?: number): void {
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    const state = createGame(kingdomWarMode, this.registry, seatIds, rngSeed);
    this._state.set(state);
    this._revealedSeatId.set(null);
    this._lastError.set(null);
  }

  reveal(seatId: string): void {
    this._revealedSeatId.set(seatId);
  }

  submit(action: Action): void {
    const state = this._state();
    if (!state) return;
    try {
      const result = resolve(state, action, this.ctx);
      this._state.set(result.state);
      this._revealedSeatId.set(null);
      this._lastError.set(null);
    } catch (err) {
      this._lastError.set(err instanceof Error ? err.message : String(err));
    }
  }

  clearError(): void {
    this._lastError.set(null);
  }
}
