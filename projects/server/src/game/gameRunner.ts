import type { BotPolicy, BotTurnMemory } from 'bots';
import { defaultActionsFor, describeDecision, EMPTY_CLOCK, expireClock, getActiveSeatId, getLegalActions, redactStateForSeat, switchClock } from 'engine';
import type { Action, ClockState, DecisionKind, EngineContext, GameState } from 'engine';
import type { ActionSource, GameClockView, GameUpdate } from 'protocol';
import { GameRecord } from '../persistence/records';
import { NewGameAction } from '../persistence/repositories';
import { RoomError } from '../rooms/errors';
import { toGameUpdate } from '../views/game';
import { applyActions, applyMove, IllegalMoveError, stateHash } from './engineGame';

// Delay before each bot move, so people can follow along.
export const BOT_DELAY_MS = 1500;
// An open room's seat goes to a bot once its player has been away this long…
export const TAKEOVER_AWAY_MS = 60_000;
// …or after this many timeouts in a row while they are away (spec "Takeover").
export const TAKEOVER_TIMEOUTS = 2;

// What a runner needs from its room.
export interface RunnerHost {
  now(): number;
  // Runs `work` on the room's queue after `delayMs`. Returns the cancel.
  schedule(delayMs: number, work: () => Promise<void>): () => void;
  // Stores the actions, or throws and stores none.
  persist(actions: NewGameAction[]): Promise<void>;
  // Sends every member their update, with the log from `logFrom`.
  publish(logFrom: number): void;
  // A seat was taken over or given back: members' botControlled changed.
  seatsChanged(): void;
  // The game has a result. Called once, after the final publish.
  finished(): Promise<void>;
  // The engine (or a bot) failed on a move the server made.
  broke(err: unknown): Promise<void>;
  logError(err: unknown, message: string): void;
}

export interface RunnerOptions {
  // A solo game pauses while its player is away, and never takes a seat over.
  solo: boolean;
  botDelayMs: number;
  takeoverAwayMs: number;
  policy: BotPolicy;
}

export interface RunnerInput {
  record: GameRecord;
  state: GameState;
  // How many actions `state` has applied.
  seq: number;
  // Members connected now. Every other human starts away.
  connected: ReadonlySet<string>;
  // Current members. A human seat whose member is gone is a bot's to the end.
  present: ReadonlySet<string>;
}

type Timer = { kind: 'clock' } | { kind: 'bot'; seatId: string; decision: DecisionKind; endsAt: number };

// One running game (spec "Game runner"): the only code that moves its state.
// Every call and every timer runs on the room's queue, one at a time.
export class GameRunner {
  readonly record: GameRecord;
  state: GameState;
  seq: number;
  private clock: ClockState = EMPTY_CLOCK;
  private timer: Timer | null = null;
  private cancelTimer: (() => void) | null = null;
  // Bumped whenever timers are cancelled, so work scheduled before is ignored.
  private generation = 0;
  private stopped = false;
  private readonly memories = new Map<string, BotTurnMemory>();
  // Humans without a connection, and since when (ms).
  private readonly away = new Map<string, number>();
  // Human seats a bot plays until their player returns.
  private readonly controlled = new Set<string>();
  // Human seats whose player left: a bot plays them to the end.
  private readonly gone = new Set<string>();
  // Per seat: timeouts in a row while its player was away.
  private readonly timeouts = new Map<string, number>();

  constructor(
    input: RunnerInput,
    private readonly ctx: EngineContext,
    private readonly host: RunnerHost,
    private readonly options: RunnerOptions
  ) {
    this.record = input.record;
    this.state = input.state;
    this.seq = input.seq;
    const now = host.now();
    for (const seat of input.record.seats) {
      if (seat.kind !== 'human') continue;
      if (!input.present.has(seat.roomPlayerId)) this.gone.add(seat.seatId);
      else if (!input.connected.has(seat.roomPlayerId)) this.away.set(seat.roomPlayerId, now);
    }
  }

  get id(): string {
    return this.record.id;
  }

  // A solo game waits while its player is away: no clock, no bot moves.
  get paused(): boolean {
    return this.options.solo && this.record.seats.some((s) => s.kind === 'human' && this.away.has(s.roomPlayerId));
  }

  seatOf(playerId: string): string | null {
    return this.record.seats.find((s) => s.roomPlayerId === playerId)?.seatId ?? null;
  }

  // Whether a bot plays this member's seat now (RoomSnapshot.botControlled).
  botControlled(playerId: string): boolean {
    const seatId = this.seatOf(playerId);
    return seatId !== null && (this.controlled.has(seatId) || this.gone.has(seatId));
  }

  // Whether a bot moves for this seat: a bot's seat, or a human's it took over.
  isBotPlayed(seatId: string): boolean {
    const seat = this.record.seats.find((s) => s.seatId === seatId);
    return seat?.kind !== 'human' || this.controlled.has(seatId) || this.gone.has(seatId);
  }

  // Sets the first clock or bot move. Call once, after construction.
  start(): void {
    this.reschedule();
  }

  // No more moves or timers: the game ended, or the room is going away.
  stop(): void {
    this.stopped = true;
    this.cancel();
  }

  // A seated member's move (spec "Processing an action input"). A refusal
  // throws a RoomError and changes nothing.
  async submit(playerId: string, gameId: string, baseSeq: number, actions: Action[]): Promise<void> {
    if (gameId !== this.record.id) throw new RoomError('stale');
    const seatId = this.seatOf(playerId);
    if (this.stopped || !seatId) throw new RoomError('not_your_turn');
    // A Close that lost a race (to the timeout, or to another player's Close) is stale, not out of turn.
    if (baseSeq !== this.seq && actions.length === 1 && actions[0].kind === 'AcknowledgeJudgmentAction' && !this.isBotPlayed(seatId)) throw new RoomError('stale');
    const close = this.asClose(seatId, actions);
    if (!close && (this.isBotPlayed(seatId) || getActiveSeatId(this.state) !== seatId)) throw new RoomError('not_your_turn');
    if (baseSeq !== this.seq) throw new RoomError('stale');
    // A close is the acting seat's move (the engine has one actor), done on behalf of `seatId`.
    const move = close ?? { seatId, actions };
    let steps: GameState[];
    try {
      steps = applyMove(this.ctx, this.state, move.seatId, move.actions);
    } catch (err) {
      if (err instanceof IllegalMoveError) throw new RoomError('illegal_action');
      throw err;
    }
    this.timeouts.delete(seatId);
    await this.commit(seatId, 'human', move.actions, steps);
  }

  // A person's Close of a settled judgment as the acting seat's action, `by` the closing seat; the
  // client's own seatId and by are ignored. Null when this is not one: no settled judgment, not exactly
  // one acknowledgement, or a seat that cannot close (a bot-played or eliminated one).
  private asClose(seatId: string, actions: Action[]): { seatId: string; actions: Action[] } | null {
    const acting = getActiveSeatId(this.state);
    if (!acting || actions.length !== 1 || actions[0].kind !== 'AcknowledgeJudgmentAction' || !this.canClose(seatId)) return null;
    return { seatId: acting, actions: [{ kind: 'AcknowledgeJudgmentAction', seatId: acting, by: seatId }] };
  }

  // Whether this seat may close the settled judgment: a living human seat no bot is playing.
  private canClose(seatId: string): boolean {
    const seat = this.record.seats.find((s) => s.seatId === seatId);
    return !!this.state.judgmentView?.settled && seat?.kind === 'human' && !this.isBotPlayed(seatId) && !this.state.seats.find((x) => x.id === seatId)?.eliminated;
  }

  // The member has a connection again. A taken-over seat comes back now (no
  // bot move is under way: the queue runs one input at a time), and a solo
  // game resumes.
  connected(playerId: string): void {
    if (this.stopped) return;
    this.away.delete(playerId);
    const seatId = this.seatOf(playerId);
    if (seatId) this.timeouts.delete(seatId);
    const reclaimed = seatId !== null && this.controlled.delete(seatId);
    if (reclaimed) this.host.seatsChanged();
    if (reclaimed || this.options.solo) this.refresh();
  }

  disconnected(playerId: string): void {
    if (this.stopped || !this.seatOf(playerId)) return;
    this.away.set(playerId, this.host.now());
    if (this.options.solo) this.refresh();
  }

  // The member left the room: a bot plays their seat for the rest of the game.
  left(playerId: string): void {
    const seatId = this.seatOf(playerId);
    if (this.stopped || !seatId) return;
    this.away.delete(playerId);
    this.controlled.delete(seatId);
    this.gone.add(seatId);
    this.refresh();
  }

  // The room tick. In an open room, a seat whose player has been away long
  // enough goes to a bot.
  tick(): void {
    if (this.stopped || this.options.solo) return;
    const now = this.host.now();
    let changed = false;
    for (const [playerId, since] of this.away) {
      const seatId = this.seatOf(playerId);
      if (!seatId || this.isBotPlayed(seatId) || now - since < this.options.takeoverAwayMs) continue;
      this.controlled.add(seatId);
      changed = true;
    }
    if (!changed) return;
    this.host.seatsChanged();
    this.refresh();
  }

  // What this member is sent: their seat's view, their moves when they must
  // act, the log from `logFrom`, and the clock. Null for a member with no seat.
  updateFor(playerId: string, logFrom: number): GameUpdate | null {
    const seatId = this.seatOf(playerId);
    if (!seatId) return null;
    const acting = !this.stopped && !this.paused && getActiveSeatId(this.state) === seatId && !this.isBotPlayed(seatId);
    // A settled judgment may be closed by any person-controlled seat, not only the one that acts on it.
    const closing = !this.stopped && !this.paused && this.canClose(seatId);
    const legalActions: Action[] = closing ? [{ kind: 'AcknowledgeJudgmentAction', seatId }] : acting ? getLegalActions(this.state, seatId, this.ctx.registry) : [];
    return toGameUpdate({
      gameId: this.record.id,
      seq: this.seq,
      state: this.state,
      seatId,
      legalActions,
      logFrom,
      clock: this.clockView(),
      paused: this.paused,
    });
  }

  // The clock or the pause changed, not the state: reschedule and tell everyone.
  private refresh(): void {
    this.reschedule();
    this.host.publish(this.state.log.length);
  }

  // Stores a move, then applies it. A human move that can't be stored throws.
  // A server move that can't be stored is logged and retried. `stored` runs
  // once the move is stored, before the next decision is scheduled. Returns
  // whether the move was stored. An engine failure after that (setting the
  // next timer, or building the updates) breaks the game: the move stands, so
  // it is not thrown.
  private async commit(seatId: string, source: ActionSource, actions: Action[], steps: GameState[], stored?: () => void): Promise<boolean> {
    const rows: NewGameAction[] = actions.map((action, i) => ({ seq: this.seq + 1 + i, seatId, source, action, stateHash: stateHash(steps[i]) }));
    try {
      await this.host.persist(rows);
    } catch (err) {
      if (source === 'human') throw err;
      this.host.logError(err, `Game ${this.record.id}: a ${source} move could not be stored; retrying`);
      this.reschedule();
      return false;
    }
    const logFrom = this.state.log.length;
    this.state = steps[steps.length - 1];
    this.seq += rows.length;
    try {
      stored?.();
      if (this.state.result) this.stop();
      else this.reschedule();
      this.host.publish(logFrom);
    } catch (err) {
      await this.breakDown(err);
      return true;
    }
    if (this.state.result) await this.host.finished();
    return true;
  }

  // Cancels the timer, then sets the next one: a bot move for a bot-played
  // seat, or the human's decision clock. A paused solo game sets none.
  private reschedule(): void {
    this.cancel();
    if (this.stopped) return;
    const now = this.host.now();
    const seatId = getActiveSeatId(this.state);
    if (!seatId) {
      this.clock = switchClock(this.clock, null, now);
      return;
    }
    const decision = describeDecision(this.state, seatId, getLegalActions(this.state, seatId, this.ctx.registry), String(this.seq));
    const generation = this.generation;
    if (this.isBotPlayed(seatId) && !this.closedByClock()) {
      // A human's Play phase clock waits while a bot responds.
      this.clock = switchClock(this.clock, null, now);
      if (this.paused) return;
      this.timer = { kind: 'bot', seatId, decision: decision?.kind ?? 'response', endsAt: now + this.options.botDelayMs };
      this.cancelTimer = this.host.schedule(this.options.botDelayMs, () => this.botMove(generation));
      return;
    }
    this.clock = switchClock(this.clock, this.paused ? null : decision, now);
    const running = this.clock.running;
    if (!running) return;
    this.timer = { kind: 'clock' };
    this.cancelTimer = this.host.schedule(Math.max(0, running.endsAt - now), () => this.timeout(generation));
  }

  // Whether a person is playing some seat: a living human seat that no bot is playing.
  private personControlled(): boolean {
    return this.record.seats.some((s) => s.kind === 'human' && !this.isBotPlayed(s.seatId) && !this.state.seats.find((x) => x.id === s.seatId)?.eliminated);
  }

  // A settled judgment while a person is playing is closed by the clock (or a person), never by a
  // bot, even when the seat that acts on it is one a bot is playing.
  private closedByClock(): boolean {
    return !!this.state.judgmentView?.settled && this.personControlled();
  }

  private cancel(): void {
    this.generation += 1;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.timer = null;
  }

  private async botMove(generation: number): Promise<void> {
    if (this.stopped || generation !== this.generation) return;
    const seatId = getActiveSeatId(this.state);
    if (!seatId || !this.isBotPlayed(seatId) || this.closedByClock()) return this.reschedule();
    let action: Action;
    let memory: BotTurnMemory;
    let steps: GameState[];
    try {
      const legal = getLegalActions(this.state, seatId, this.ctx.registry);
      const decision = this.options.policy.decide(redactStateForSeat(this.state, seatId), seatId, legal, this.ctx.registry, this.memories.get(seatId) ?? null);
      action = decision.action;
      memory = decision.memory;
      steps = applyActions(this.ctx, this.state, [action]);
    } catch (err) {
      return this.breakDown(err);
    }
    const isBotSeat = this.record.seats.find((s) => s.seatId === seatId)?.kind === 'bot';
    if (await this.commit(seatId, isBotSeat ? 'bot' : 'takeover', [action], steps)) this.memories.set(seatId, memory);
  }

  // The clock ran out: the engine's default for the decision, as one move.
  private async timeout(generation: number): Promise<void> {
    if (this.stopped || generation !== this.generation) return;
    const seatId = getActiveSeatId(this.state);
    if (!seatId || (this.isBotPlayed(seatId) && !this.closedByClock())) return this.reschedule();
    this.clock = expireClock(this.clock);
    let actions: Action[];
    let steps: GameState[];
    try {
      actions = defaultActionsFor(this.state, getLegalActions(this.state, seatId, this.ctx.registry));
      steps = applyActions(this.ctx, this.state, actions);
    } catch (err) {
      return this.breakDown(err);
    }
    const playerId = this.record.seats.find((s) => s.seatId === seatId)?.roomPlayerId ?? null;
    let takeOver = false;
    // Counted only once stored, so a retried timeout counts once. The seat
    // goes to the bot before the next decision is scheduled, so that decision
    // is already the bot's.
    const stored = () => {
      // A judgment closing itself asks nothing of the player: it is not a missed decision.
      if (actions.some((a) => a.kind === 'AcknowledgeJudgmentAction')) return;
      const inARow = playerId !== null && this.away.has(playerId) ? (this.timeouts.get(seatId) ?? 0) + 1 : 0;
      this.timeouts.set(seatId, inARow);
      takeOver = !this.options.solo && inARow >= TAKEOVER_TIMEOUTS;
      if (takeOver) this.controlled.add(seatId);
    };
    await this.commit(seatId, 'timeout', actions, steps, stored);
    if (takeOver) this.host.seatsChanged();
  }

  private async breakDown(err: unknown): Promise<void> {
    this.stop();
    await this.host.broke(err);
  }

  private clockView(): GameClockView | null {
    const now = this.host.now();
    const timer = this.timer;
    if (timer?.kind === 'bot') return { seatId: timer.seatId, kind: timer.decision, endsAt: timer.endsAt, totalSeconds: this.options.botDelayMs / 1000, serverNow: now, bot: true };
    const running = this.clock.running;
    if (timer?.kind !== 'clock' || !running) return null;
    return { seatId: running.decision.seatId, kind: running.decision.kind, endsAt: running.endsAt, totalSeconds: running.totalMs / 1000, serverNow: now };
  }
}
