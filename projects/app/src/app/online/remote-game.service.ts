import { computed, DestroyRef, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { getActiveSeatId, previewEffect } from 'engine';
import type { Action, ContentRegistry, Effect, EngineContext, EngineEvent, GameState } from 'engine';
import { ERROR_MESSAGES } from 'protocol';
import type { GameUpdate, LastGame, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import type { DecisionTimer } from '../decision-timer.service';
import type { GameMode, GameService } from '../game.service';
import { SocketService } from './socket.service';

// What GameBoard reads from GameService. The online board provides
// RemoteGameService in its place, so the board itself stays as it is.
export type BoardGame = Pick<
  GameService,
  | 'registry'
  | 'mode'
  | 'state'
  | 'visibleState'
  | 'humanSeatId'
  | 'revealedSeatId'
  | 'activeSeatId'
  | 'legalActions'
  | 'botSeatIds'
  | 'botThinkingSeatId'
  | 'lastError'
  | 'previewEffect'
  | 'reveal'
  | 'submit'
  | 'submitAll'
  | 'clearError'
>;

// The running clock, moved onto this device's time.
export interface LocalClock {
  seatId: string;
  endsAt: number;
  totalSeconds: number;
}

// The seed stays on the server. Nothing on the client draws from this.
const NO_RNG = { seed: 0, counter: 0 };

// The server's game as the board sees it, kept from the room socket. The
// server decides every move: this shows what it sends and submits what the
// player picks. Previews run on the received view with the local engine.
@Injectable()
export class RemoteGameService implements BoardGame {
  private readonly socket = inject(SocketService);
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: kingdomWarMode };
  private log: EngineEvent[] = [];
  private readonly _update = signal<GameUpdate | null>(null);
  private readonly _state = signal<GameState | null>(null);
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _lastError = signal<string | null>(null);
  private readonly _waiting = signal(false);
  private readonly _clock = signal<LocalClock | null>(null);
  private readonly _dismissed = signal<string | null>(null);

  // Never 'vs-bots': in that mode the board offers New Game, which goes to the local Setup.
  readonly mode: Signal<GameMode> = signal<GameMode>('pass-and-play').asReadonly();
  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly visibleState: Signal<GameState | null> = this._state.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();
  readonly clock: Signal<LocalClock | null> = this._clock.asReadonly();
  readonly paused = computed(() => this._update()?.paused ?? false);

  readonly humanSeatId: Signal<string | null> = computed(() => {
    const you = this._you();
    return this._room()?.members.find((m) => m.playerId === you)?.seatId ?? null;
  });
  // Always the player's own seat, so the board never shows the pass-and-play gate.
  readonly revealedSeatId: Signal<string | null> = this.humanSeatId;

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

  // The server's offer, while the socket is up and no move is waiting for its answer.
  readonly legalActions: Signal<Action[]> = computed(() => (this.socket.status() === 'open' && !this._waiting() ? (this._update()?.legalActions ?? []) : []));

  // Bot seats, and human seats a bot plays for now.
  readonly botSeatIds: Signal<string[]> = computed(() => {
    const bots = new Set(this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []);
    for (const member of this._room()?.members ?? []) if (member.botControlled && member.seatId) bots.add(member.seatId);
    return [...bots];
  });

  // A clock on a bot-played seat is that bot about to move.
  readonly botThinkingSeatId: Signal<string | null> = computed(() => {
    const clock = this._clock();
    return clock && this.botSeatIds().includes(clock.seatId) ? clock.seatId : null;
  });

  // How the last game ended, until the player dismisses it. It comes from
  // the room's last game, or from the final update, which arrives just
  // before the room says so.
  readonly ending: Signal<LastGame | null> = computed(() => {
    const room = this._room();
    const dismissed = this._dismissed();
    if (room?.status === 'lobby' && room.lastGame && room.lastGame.gameId !== dismissed) return room.lastGame;
    const update = this._update();
    const state = this._state();
    if (room?.status !== 'playing' || !update || !state?.result || update.gameId === dismissed) return null;
    return {
      gameId: update.gameId,
      outcome: 'finished',
      result: state.result,
      seats: state.players.map((p) => ({ seatId: p.seatId, playerId: room.members.find((m) => m.seatId === p.seatId)?.playerId ?? '', name: p.name })),
    };
  });

  // A game is on and still going: the board shows.
  readonly playing: Signal<boolean> = computed(() => this._room()?.status === 'playing' && this._state() !== null && this.ending() === null);

  constructor() {
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  dismiss(): void {
    const ending = this.ending();
    if (ending) this._dismissed.set(ending.gameId);
  }

  // The board never gates a remote seat.
  reveal(_seatId: string): void {}

  submit(action: Action): void {
    this.submitAll([action]);
  }

  // One move: the server applies all of it or none of it.
  submitAll(actions: Action[]): void {
    const update = this._update();
    if (!update || actions.length === 0 || this._waiting()) return;
    this._waiting.set(true);
    this._lastError.set(null);
    this.socket
      .request({ type: 'game.submit', gameId: update.gameId, baseSeq: update.seq, actions })
      .catch((err: unknown) => {
        this._lastError.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
        if (err instanceof ApiError && err.code === 'stale') this.resync();
      })
      .finally(() => this._waiting.set(false));
  }

  clearError(): void {
    this._lastError.set(null);
  }

  previewEffect(state: GameState, effect: Effect): Effect | null {
    return previewEffect(state, effect, this.ctx);
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this._you.set(message.you.playerId);
        this._room.set(message.room);
        this.log = [];
        if (message.game) this.apply(message.game);
        else this.clear();
        return;
      case 'room.updated':
        this._room.set(message.room);
        return;
      case 'game.update':
        this.apply(message.game);
        return;
    }
  }

  private apply(update: GameUpdate): void {
    if (update.logFrom === 0 || this._update()?.gameId !== update.gameId) this.log = [];
    if (update.logFrom !== this.log.length) {
      this.resync();
      return;
    }
    this.log = [...this.log, ...update.events];
    this._update.set(update);
    this._state.set({ ...update.view, log: this.log, rng: NO_RNG });
    const clock = update.clock;
    this._clock.set(clock && { seatId: clock.seatId, endsAt: Date.now() + (clock.endsAt - clock.serverNow), totalSeconds: clock.totalSeconds });
  }

  private clear(): void {
    this._update.set(null);
    this._state.set(null);
    this._clock.set(null);
  }

  private resync(): void {
    this.socket.request({ type: 'game.resync' }).catch(() => undefined);
  }
}

// The countdown the board and its dialogs show, from the server's clock: the
// viewer's own decisions only (a bot's clock shows as "thinking…" instead).
// The server times out with the engine's default, so a half-made pick is not
// sent ahead.
@Injectable()
export class RemoteDecisionClock implements Pick<DecisionTimer, 'secondsLeft' | 'totalSeconds' | 'attach' | 'setTimeoutChoice'> {
  private readonly game = inject(RemoteGameService);
  private readonly now = signal(Date.now());
  private readonly own = computed(() => {
    const clock = this.game.clock();
    return clock && clock.seatId === this.game.humanSeatId() && !this.game.paused() ? clock : null;
  });

  readonly secondsLeft: Signal<number | null> = computed(() => {
    const clock = this.own();
    return clock ? Math.max(0, Math.ceil((clock.endsAt - this.now()) / 1000)) : null;
  });
  readonly totalSeconds: Signal<number | null> = computed(() => this.own()?.totalSeconds ?? null);

  constructor() {
    // Ticks only while there is a countdown to show.
    effect((onCleanup) => {
      if (!this.own()) return;
      this.now.set(Date.now());
      const interval = setInterval(() => this.now.set(Date.now()), 250);
      onCleanup(() => clearInterval(interval));
    });
  }

  // The online board is always on screen while it exists: nothing to pause.
  attach(_destroyRef: DestroyRef): void {}

  setTimeoutChoice(_actions: Action[]): void {}
}
