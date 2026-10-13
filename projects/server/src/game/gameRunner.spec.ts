import { ruleBasedPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { defaultActionsFor, getActiveSeatId, getLegalActions } from 'engine';
import type { Action } from 'engine';
import type { MemberKind } from 'protocol';
import { GameRecord, GameSeat } from '../persistence/records';
import { NewGameAction } from '../persistence/repositories';
import { engineContext, openingState, stateHash } from './engineGame';
import { BOT_DELAY_MS, GameRunner, RunnerHost, TAKEOVER_AWAY_MS } from './gameRunner';
import { ManualScheduler } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const GAME_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEED = 1234;
const registry = buildContentRegistry();
const ctx = engineContext(registry);
const code = (value: string) => expect.objectContaining({ code: value });

class FakeHost implements RunnerHost {
  readonly scheduler = new ManualScheduler(T0);
  readonly stored: NewGameAction[] = [];
  readonly published: number[] = [];
  readonly errors: unknown[] = [];
  seatsChangedCount = 0;
  finishedCount = 0;
  broken: unknown = null;
  failPersist = false;
  // An error publish throws, as the engine might while building the updates.
  failPublish: Error | null = null;
  now = () => this.scheduler.now;
  schedule = (delayMs: number, work: () => Promise<void>) => this.scheduler.schedule(delayMs, work);
  async persist(actions: NewGameAction[]): Promise<void> {
    if (this.failPersist) throw new Error('database down');
    this.stored.push(...actions);
  }
  publish(logFrom: number): void {
    if (this.failPublish) throw this.failPublish;
    this.published.push(logFrom);
  }
  seatsChanged(): void {
    this.seatsChangedCount += 1;
  }
  async finished(): Promise<void> {
    this.finishedCount += 1;
  }
  async broke(err: unknown): Promise<void> {
    this.broken = err;
  }
  logError(err: unknown): void {
    this.errors.push(err);
  }
}

// Seat i is played by member `p${i}`. Every human in `connected` starts connected.
function setup(options: { kinds?: MemberKind[]; solo?: boolean; connected?: string[]; policy?: BotPolicy } = {}) {
  const kinds = options.kinds ?? ['human', 'bot'];
  const seats: GameSeat[] = kinds.map((kind, i) => ({ seatId: `seat-${i}`, roomPlayerId: `p${i}`, name: kind === 'bot' ? `Bot ${i}` : `Player ${i}`, kind }));
  const record: GameRecord = {
    id: GAME_ID,
    roomId: 'room-1',
    seed: SEED,
    seats,
    rules: {},
    buildId: 'test',
    status: 'running',
    result: null,
    actionCount: 0,
    startedAt: new Date(T0),
    finishedAt: null,
  };
  const host = new FakeHost();
  const runner = new GameRunner(
    {
      record,
      state: openingState(ctx, SEED, seats, {}),
      seq: 0,
      connected: new Set(options.connected ?? ['p0']),
      present: new Set(seats.map((s) => s.roomPlayerId)),
    },
    ctx,
    host,
    { solo: options.solo ?? false, botDelayMs: BOT_DELAY_MS, takeoverAwayMs: TAKEOVER_AWAY_MS, policy: options.policy ?? ruleBasedPolicy }
  );
  runner.start();
  return { runner, host, scheduler: host.scheduler, legal: () => runner.updateFor('p0', 0)!.legalActions };
}

describe('GameRunner', () => {
  it("starts the first decision on its human seat's clock, offering moves to that seat only", () => {
    const { runner } = setup();
    const update = runner.updateFor('p0', 0)!;
    expect(update.clock).toEqual({ seatId: 'seat-0', kind: 'selection', endsAt: T0 + 300_000, totalSeconds: 300, serverNow: T0 });
    expect(update.legalActions.length).toBeGreaterThan(0);
    expect(update.events).toEqual(runner.state.log);
    expect(update.view).not.toHaveProperty('rng');
    expect(runner.updateFor('p1', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('nobody', 0)).toBeNull();
  });

  it('applies an offered move, stores it with its state hash, and publishes from the old log length', async () => {
    const { runner, host, legal } = setup();
    const logBefore = runner.state.log.length;
    const [move] = legal();
    await runner.submit('p0', GAME_ID, 0, [move]);
    expect(runner.seq).toBe(1);
    expect(host.stored).toEqual([{ seq: 1, seatId: 'seat-0', source: 'human', action: move, stateHash: stateHash(runner.state) }]);
    expect(host.published).toEqual([logBefore]);
  });

  it('refuses moves out of turn, stale or never offered, and changes nothing (Review Focus 1 and 2)', async () => {
    const { runner, host, legal } = setup();
    const before = runner.state;
    const [move] = legal();
    await expect(runner.submit('p1', GAME_ID, 0, [{ ...move, seatId: 'seat-1' } as Action])).rejects.toEqual(code('not_your_turn'));
    await expect(runner.submit('p0', GAME_ID, 1, [move])).rejects.toEqual(code('stale'));
    await expect(runner.submit('p0', 'aaaaaaaa-0000-4000-8000-000000000002', 0, [move])).rejects.toEqual(code('stale'));
    await expect(runner.submit('p0', GAME_ID, 0, [{ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }])).rejects.toEqual(code('illegal_action'));
    await expect(runner.submit('p0', GAME_ID, 0, [{ ...move, extra: 1 } as unknown as Action])).rejects.toEqual(code('illegal_action'));
    await expect(runner.submit('p0', GAME_ID, 0, [move, move])).rejects.toEqual(code('illegal_action'));
    expect(runner.seq).toBe(0);
    expect(runner.state).toBe(before);
    expect(host.stored).toEqual([]);
    expect(host.published).toEqual([]);
  });

  it('refuses a human move that cannot be stored, and keeps the state', async () => {
    const { runner, host, legal } = setup();
    host.failPersist = true;
    await expect(runner.submit('p0', GAME_ID, 0, [legal()[0]])).rejects.toThrow('database down');
    expect(runner.seq).toBe(0);
  });

  it("moves a bot seat after the bot delay, and shows the bot's timer as its clock", async () => {
    const { runner, host, scheduler, legal } = setup();
    await runner.submit('p0', GAME_ID, 0, [legal()[0]]);
    expect(runner.updateFor('p0', 0)!.clock).toEqual({ seatId: 'seat-1', kind: 'selection', endsAt: T0 + BOT_DELAY_MS, totalSeconds: BOT_DELAY_MS / 1000, serverNow: T0 });
    await scheduler.advance(BOT_DELAY_MS - 1);
    expect(host.stored).toHaveLength(1);
    await scheduler.advance(1);
    expect(host.stored[1]).toMatchObject({ seq: 2, seatId: 'seat-1', source: 'bot' });
  });

  it("submits the engine's default when the clock runs out", async () => {
    const { runner, host, scheduler } = setup();
    const opening = runner.state;
    await scheduler.advance(300_000);
    expect(host.stored).toEqual([
      { seq: 1, seatId: 'seat-0', source: 'timeout', action: defaultActionsFor(opening, getLegalActions(opening, 'seat-0', registry))[0], stateHash: stateHash(runner.state) },
    ]);
  });

  it('hands a seat to a bot after two timeouts in a row while its player is away', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    await scheduler.runUntil(() => runner.botControlled('p0'));
    expect(runner.botControlled('p0')).toBe(true);
    expect(host.seatsChangedCount).toBe(1);
    expect(host.stored.filter((a) => a.source === 'takeover')).toEqual([]);
    expect(host.stored.filter((a) => a.seatId === 'seat-0').every((a) => a.source === 'timeout')).toBe(true);
    await scheduler.runUntil(() => host.stored.some((a) => a.source === 'takeover'));
    expect(host.stored.find((a) => a.source === 'takeover')?.seatId).toBe('seat-0');
  });

  it('never hands a connected player\'s seat to a bot for timing out', async () => {
    const { runner, host, scheduler } = setup();
    await scheduler.runUntil(() => host.stored.filter((a) => a.source === 'timeout').length >= 3);
    expect(runner.botControlled('p0')).toBe(false);
  });

  it('gives the seat back when its player returns, cancelling a pending bot move (Review Focus 3)', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    await scheduler.runUntil(() => runner.botControlled('p0'));
    await scheduler.runUntil(() => getActiveSeatId(runner.state) === 'seat-0' && !runner.state.result);
    const storedBefore = host.stored.length;
    runner.connected('p0');
    expect(runner.botControlled('p0')).toBe(false);
    expect(host.seatsChangedCount).toBe(2);
    const update = runner.updateFor('p0', 0)!;
    expect(update.legalActions.length).toBeGreaterThan(0);
    expect(update.clock?.seatId).toBe('seat-0');
    expect(update.clock?.totalSeconds).not.toBe(BOT_DELAY_MS / 1000);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored.slice(storedBefore).filter((a) => a.source === 'takeover')).toEqual([]);
  });

  it("hands an open room's seat to a bot once its player has been away 60 s, on the tick", async () => {
    const { runner, host, scheduler } = setup();
    runner.disconnected('p0');
    await scheduler.advance(TAKEOVER_AWAY_MS - 1);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(false);
    await scheduler.advance(1);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(true);
    expect(host.seatsChangedCount).toBe(1);
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', totalSeconds: BOT_DELAY_MS / 1000 });
  });

  it("never hands a solo room's seat to a bot", async () => {
    const { runner, scheduler } = setup({ solo: true });
    runner.disconnected('p0');
    await scheduler.advance(2 * TAKEOVER_AWAY_MS);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(false);
  });

  it('pauses a solo game while its player is away, and resumes the clock where it stopped', async () => {
    const { runner, host, scheduler } = setup({ solo: true });
    await scheduler.advance(100_000);
    runner.disconnected('p0');
    expect(runner.paused).toBe(true);
    expect(scheduler.pending).toBe(0);
    expect(runner.updateFor('p0', 0)).toMatchObject({ paused: true, clock: null, legalActions: [] });
    await scheduler.advance(3_600_000);
    expect(host.stored).toEqual([]);
    runner.connected('p0');
    expect(runner.paused).toBe(false);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', endsAt: scheduler.now + 200_000 });
  });

  it('keeps bots still while a solo game is paused', async () => {
    const { runner, host, scheduler, legal } = setup({ solo: true });
    await runner.submit('p0', GAME_ID, 0, [legal()[0]]);
    runner.disconnected('p0');
    await scheduler.advance(10_000);
    expect(host.stored).toHaveLength(1);
    runner.connected('p0');
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toHaveLength(2);
  });

  it('plays a game to its end and reports it finished once', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'bot'], connected: [] });
    await scheduler.runUntil(() => host.finishedCount > 0);
    expect(runner.state.result).not.toBeNull();
    expect(host.finishedCount).toBe(1);
    expect(host.stored.map((a) => a.seq)).toEqual(Array.from({ length: runner.seq }, (_, i) => i + 1));
    expect(host.stored.at(-1)?.stateHash).toBe(stateHash(runner.state));
    expect(scheduler.pending).toBe(0);
    expect(runner.updateFor('p0', 0)).toMatchObject({ legalActions: [], clock: null });
  }, 60_000);

  it('reports the game broken when the engine or a bot fails on a move the server makes', async () => {
    const failing: BotPolicy = {
      id: 'failing',
      decide: () => {
        throw new Error('bot bug');
      },
    };
    const { host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'], policy: failing });
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.broken).toEqual(new Error('bot bug'));
    expect(scheduler.pending).toBe(0);
  });

  it('retries a bot move that could not be stored', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'] });
    host.failPersist = true;
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.errors).toHaveLength(1);
    expect(runner.seq).toBe(0);
    expect(scheduler.pending).toBe(1);
    host.failPersist = false;
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toEqual([expect.objectContaining({ seq: 1, seatId: 'seat-0', source: 'bot' })]);
  });

  it("gives a departed member's seat to a bot for the rest of the game", async () => {
    const { runner, host, scheduler } = setup();
    runner.left('p0');
    expect(runner.botControlled('p0')).toBe(true);
    runner.connected('p0');
    expect(runner.botControlled('p0')).toBe(true);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', source: 'takeover' });
  });

  it('reports the game broken, not the move refused, when the engine fails after a human move is stored', async () => {
    const { runner, host, scheduler, legal } = setup();
    host.failPublish = new Error('engine bug');
    await expect(runner.submit('p0', GAME_ID, 0, [legal()[0]])).resolves.toBeUndefined();
    expect(host.stored).toHaveLength(1);
    expect(runner.seq).toBe(1);
    expect(host.broken).toEqual(new Error('engine bug'));
    expect(scheduler.pending).toBe(0);
  });

  it('reports the game broken when the engine fails after a bot move is stored', async () => {
    const { host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'] });
    host.failPublish = new Error('engine bug');
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toHaveLength(1);
    expect(host.broken).toEqual(new Error('engine bug'));
    expect(scheduler.pending).toBe(0);
  });

  it('counts a timeout that could not be stored only once, when its retry is stored', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    host.failPersist = true;
    await scheduler.runUntil(() => host.errors.length > 0);
    host.failPersist = false;
    await scheduler.runUntil(() => host.stored.length > 0);
    expect(host.stored).toEqual([expect.objectContaining({ seq: 1, seatId: 'seat-0', source: 'timeout' })]);
    expect(runner.botControlled('p0')).toBe(false);
    expect(host.seatsChangedCount).toBe(0);
  });
});
