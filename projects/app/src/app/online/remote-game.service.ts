import { computed, DestroyRef, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { buildContentRegistry, guozhanMode } from 'content';
import { getActingSeatIds, getActiveSeatId, previewEffect } from 'engine';
import type { Action, ContentRegistry, Effect, EngineContext, DecisionKind, EngineEvent, GameState } from 'engine';
import { finalSeatViews } from 'protocol';
import type { GameUpdate, LastGame, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError, errorMsg } from '../auth/auth.service';
import type { Msg } from '../i18n/msg';
import type { DecisionTimer } from '../decision-timer.service';
import type { GameMode, GameService, SelectionRosterEntry } from '../game.service';
import { SocketService } from './socket.service';

// What GameBoard reads from GameService. The online board provides
// RemoteGameService in its place, so the board itself stays as it is.
export type BoardGame = Pick<
  GameService,
  | 'registry'
  | 'mode'
  | 'state'
  | 'visibleState'
  | 'publicState'
  | 'canCloseJudgment'
  | 'judgmentSettled'
  | 'closeJudgment'
  | 'humanSeatId'
  | 'revealedSeatId'
  | 'activeSeatId'
  | 'legalActions'
  | 'botSeatIds'
  | 'botThinkingSeatId'
  | 'selectionRoster'
  | 'gameStartsAt'
  | 'lastError'
  | 'previewEffect'
  | 'reveal'
  | 'submit'
  | 'submitAll'
  | 'clearError'
  | 'clockWaitsForPlayback'
  | 'lastMoveStart'
>;

// The running clock, moved onto this device's time.
export interface LocalClock {
  seatId: string;
  kind: DecisionKind;
  // When the countdown starts, after the animation the decision follows (this device's time).
  startsAt: number;
  endsAt: number;
  totalSeconds: number;
  // A bot's move delay, not a clock a person acts on.
  bot: boolean;
}

// The seed stays on the server. Nothing on the client draws from this.
const NO_RNG = { seed: 0, counter: 0 };

// A first decision whose clock starts at least this much (ms) after the update was sent is the game's start hold,
// not the short lead-in of an animation.
const HOLD_MIN_MS = 1000;

// The server's game as the board sees it, kept from the room socket. The
// server decides every move: this shows what it sends and submits what the
// player picks. Previews run on the received view with the local engine.
@Injectable()
export class RemoteGameService implements BoardGame {
  private readonly socket = inject(SocketService);
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: guozhanMode };
  private log: EngineEvent[] = [];
  private readonly _update = signal<GameUpdate | null>(null);
  private readonly _state = signal<GameState | null>(null);
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _lastError = signal<Msg | null>(null);
  private readonly _waiting = signal(false);
  private readonly _clock = signal<LocalClock | null>(null);
  private readonly _dismissed = signal<string | null>(null);
  private readonly _gameStartsAt = signal<number | null>(null);

  // Never 'vs-bots': in that mode the board offers New Game, which goes to the local Setup.
  readonly mode: Signal<GameMode> = signal<GameMode>('pass-and-play').asReadonly();
  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly visibleState: Signal<GameState | null> = this._state.asReadonly();
  readonly lastError: Signal<Msg | null> = this._lastError.asReadonly();
  readonly clock: Signal<LocalClock | null> = this._clock.asReadonly();
  readonly paused = computed(() => this._update()?.paused ?? false);

  readonly humanSeatId: Signal<string | null> = computed(() => {
    const you = this._you();
    return this._room()?.members.find((m) => m.playerId === you)?.seatId ?? null;
  });
  // Always the player's own seat, so the board never shows the pass-and-play gate.
  readonly revealedSeatId: Signal<string | null> = this.humanSeatId;

  // During General Selection everyone chooses at once: your own seat while you are still choosing, else
  // the first seat that is.
  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    if (!state) return null;
    if (state.phase === 'GeneralSelection' && !state.result) {
      const choosing = getActingSeatIds(state);
      const own = this.humanSeatId();
      return own && choosing.includes(own) ? own : (choosing[0] ?? null);
    }
    return getActiveSeatId(state);
  });

  // Who has confirmed their Generals: a seat with no candidates left is ready, and a bot always is. The
  // redacted view keeps each seat's key and hides what is behind it, so this shows nothing private.
  readonly selectionRoster: Signal<SelectionRosterEntry[] | null> = computed(() => {
    const state = this._state();
    if (!state || state.phase !== 'GeneralSelection' || !state.generalSelection) return null;
    const candidates = state.generalSelection.candidates;
    const bots = this.botSeatIds();
    const you = this.humanSeatId();
    return state.seats.map((seat) => ({ seatId: seat.id, ready: bots.includes(seat.id) || !Object.prototype.hasOwnProperty.call(candidates, seat.id), isYou: seat.id === you }));
  });

  // When the game starts, while its first decision still waits out the 3 seconds after the last choice.
  readonly gameStartsAt: Signal<number | null> = this._gameStartsAt.asReadonly();

  // The server clock runs whatever this screen shows, so playback catches up instead.
  readonly clockWaitsForPlayback: boolean = false;
  // There is no Pass and Play gate online: playback never restarts from an earlier move.
  readonly lastMoveStart: Signal<GameState | null> = signal<GameState | null>(null).asReadonly();

  // The server's offer, while the socket is up and no move is waiting for its answer.
  readonly legalActions: Signal<Action[]> = computed(() => (this.socket.status() === 'open' && !this._waiting() ? (this._update()?.legalActions ?? []) : []));

  // A judgment waits for an acknowledgement (the judgmentNotice rule).
  readonly judgmentSettled: Signal<boolean> = computed(() => !!this._state()?.judgmentView?.settled);

  // What a public popup may read: the member's own view, which already hides what it must.
  readonly publicState: Signal<GameState | null> = this._state.asReadonly();

  // The server offers the close to every seat a person plays.
  readonly canCloseJudgment: Signal<boolean> = computed(() => this.legalActions().some((a) => a.kind === 'AcknowledgeJudgmentAction'));

  // Bot seats, and human seats a bot plays for now.
  readonly botSeatIds: Signal<string[]> = computed(() => {
    const bots = new Set(this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []);
    for (const member of this._room()?.members ?? []) if (member.botControlled && member.seatId) bots.add(member.seatId);
    return [...bots];
  });

  // A clock on a bot-played seat is that bot about to move.
  readonly botThinkingSeatId: Signal<string | null> = computed(() => {
    const clock = this._clock();
    // A settled judgment's clock on a bot-played seat is a person's to close, unless it is the bot's own move delay.
    return clock && this.botSeatIds().includes(clock.seatId) && (clock.kind !== 'notice' || clock.bot) ? clock.seatId : null;
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
      // The final view shows every seat's Generals once the game is over.
      finalSeats: finalSeatViews(state),
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

  // Closes a settled judgment with the close the server offers this seat: it acts for the seat that
  // acts on the judgment, with `by` this seat.
  closeJudgment(): void {
    const close = this.legalActions().find((a) => a.kind === 'AcknowledgeJudgmentAction');
    if (close) this.submitAll([close], true);
  }

  // One move: the server applies all of it or none of it.
  // `quietStale`: losing a race (a Close that came second) is not worth a message; the resync follows anyway.
  submitAll(actions: Action[], quietStale = false): void {
    // A General choice that loses a race to another seat's choice or to the clock is not worth a message either.
    quietStale ||= actions.length > 0 && actions.every((a) => a.kind === 'ChooseGeneralsAction');
    const update = this._update();
    if (!update || actions.length === 0 || this._waiting()) return;
    this._waiting.set(true);
    this._lastError.set(null);
    this.socket
      .request({ type: 'game.submit', gameId: update.gameId, baseSeq: update.seq, actions })
      .catch((err: unknown) => {
        const stale = err instanceof ApiError && err.code === 'stale';
        if (!(quietStale && stale)) this._lastError.set(errorMsg(err));
        if (stale) this.resync();
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
    // The start hold: the first decision of turn 1, a person's Start window or a bot's move, whose clock starts
    // later than it was sent. (A judgment's lead-in on turn 1 is also later, but it is another kind of clock.)
    const holding = !!clock && update.view.turn.turnNumber === 1 && (clock.bot === true || clock.kind === 'start') && clock.startsAt - clock.serverNow > HOLD_MIN_MS;
    this._gameStartsAt.set(holding ? Date.now() + (clock.startsAt - clock.serverNow) : null);
    this._clock.set(clock && { seatId: clock.seatId, kind: clock.kind, bot: clock.bot === true, startsAt: Date.now() + (clock.startsAt - clock.serverNow), endsAt: Date.now() + (clock.endsAt - clock.serverNow), totalSeconds: clock.totalSeconds });
  }

  private clear(): void {
    this._update.set(null);
    this._state.set(null);
    this._clock.set(null);
    this._gameStartsAt.set(null);
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
export class RemoteDecisionClock implements Pick<DecisionTimer, 'secondsLeft' | 'totalSeconds' | 'startsInMs' | 'attach' | 'setTimeoutChoice'> {
  private readonly game = inject(RemoteGameService);
  private readonly now = signal(Date.now());
  private readonly own = computed(() => {
    const clock = this.game.clock();
    // A settled judgment's countdown is for everyone, whichever seat the clock is on.
    return clock && (clock.seatId === this.game.humanSeatId() || (clock.kind === 'notice' && !clock.bot)) && !this.game.paused() ? clock : null;
  });

  // The countdown holds its full length while the animation it follows plays, as the engine's clock does.
  readonly secondsLeft: Signal<number | null> = computed(() => {
    const clock = this.own();
    return clock ? Math.min(clock.totalSeconds, Math.max(0, Math.ceil((clock.endsAt - this.now()) / 1000))) : null;
  });
  readonly startsInMs: Signal<number | null> = computed(() => {
    const clock = this.own();
    return clock ? Math.max(0, clock.startsAt - this.now()) : null;
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
