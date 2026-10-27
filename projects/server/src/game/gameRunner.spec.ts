import { ruleBasedPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { defaultActionsFor, getActiveSeatId, getLegalActions, resolve, usedCardOf } from 'engine';
import type { Action, GameState } from 'engine';
import type { MemberKind } from 'protocol';
import { GameRecord, GameSeat } from '../persistence/records';
import { NewGameAction } from '../persistence/repositories';
import { engineContext, openingState, stateHash } from './engineGame';
import { BOT_DELAY_MS, GameRunner, RunnerHost, TAKEOVER_AWAY_MS } from './gameRunner';
import { JUDGMENT_LEAD_IN_MS } from 'engine';
import { ManualScheduler } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const GAME_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEED = 1234;
const registry = buildContentRegistry();
const ctx = engineContext(registry);
// The opening state with every seat's first legal choice made: a game in its first turn.
const pastSelection = (opening: GameState): GameState =>
  opening.seats.reduce((state, seat) => resolve(state, getLegalActions(state, seat.id, registry)[0], ctx).state, opening);
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
// `state` replaces the opening state; members in `left` have left the room (a bot plays their seat).
function setup(options: { kinds?: MemberKind[]; startHoldMs?: number; solo?: boolean; connected?: string[]; policy?: BotPolicy; state?: (opening: GameState) => GameState; left?: string[] } = {}) {
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
      state: (options.state ?? ((x) => x))(openingState(ctx, SEED, seats, {})),
      seq: 0,
      connected: new Set(options.connected ?? ['p0']),
      present: new Set(seats.map((s) => s.roomPlayerId).filter((id) => !(options.left ?? []).includes(id))),
    },
    ctx,
    host,
    { solo: options.solo ?? false, botDelayMs: BOT_DELAY_MS, takeoverAwayMs: TAKEOVER_AWAY_MS, startHoldMs: options.startHoldMs ?? 0, policy: options.policy ?? ruleBasedPolicy }
  );
  runner.start();
  return { runner, host, scheduler: host.scheduler, legal: () => runner.updateFor('p0', 0)!.legalActions };
}

describe('GameRunner: simultaneous General Selection', () => {
  const twoHumans = () => setup({ kinds: ['human', 'human'], connected: ['p0', 'p1'] });
  const choice = (runner: GameRunner, playerId: string) => runner.updateFor(playerId, 0)!.legalActions[0];

  it('offers each seat its choices from the start, before the earlier seats have chosen', () => {
    const { runner } = twoHumans();
    expect(runner.updateFor('p0', 0)!.legalActions[0]).toMatchObject({ kind: 'ChooseGeneralsAction', seatId: 'seat-0' });
    expect(runner.updateFor('p1', 0)!.legalActions[0]).toMatchObject({ kind: 'ChooseGeneralsAction', seatId: 'seat-1' });
  });

  it('stores both choices when two seats confirm from the same base seq', async () => {
    const { runner, host } = twoHumans();
    const first = choice(runner, 'p0');
    const second = choice(runner, 'p1');
    await runner.submit('p0', GAME_ID, 0, [first]);
    await runner.submit('p1', GAME_ID, 0, [second]);
    expect(runner.seq).toBe(2);
    expect(host.stored.map((row) => row.seatId)).toEqual(['seat-0', 'seat-1']);
    expect(runner.state.phase).not.toBe('GeneralSelection');
  });

  it('accepts a later seat choosing first', async () => {
    const { runner, host } = twoHumans();
    await runner.submit('p1', GAME_ID, 0, [choice(runner, 'p1')]);
    expect(host.stored.map((row) => row.seatId)).toEqual(['seat-1']);
    expect(runner.state.phase).toBe('GeneralSelection');
  });

  it('refuses a second choice from a seat that has chosen, as illegal', async () => {
    const { runner } = twoHumans();
    const first = choice(runner, 'p0');
    await runner.submit('p0', GAME_ID, 0, [first]);
    await expect(runner.submit('p0', GAME_ID, 0, [first])).rejects.toEqual(code('illegal_action'));
  });

  it('offers a seat that has chosen nothing', async () => {
    const { runner } = twoHumans();
    await runner.submit('p0', GAME_ID, 0, [choice(runner, 'p0')]);
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('p1', 0)!.legalActions.length).toBeGreaterThan(0);
  });
});

describe('GameRunner: the selection clock, bots and the start hold', () => {
  const two = (extra: Parameters<typeof setup>[0] = {}) => setup({ kinds: ['human', 'human'], connected: ['p0', 'p1'], ...extra });
  const pick = (runner: GameRunner, playerId: string, seq = runner.seq) =>
    runner.submit(playerId, GAME_ID, seq, [runner.updateFor(playerId, 0)!.legalActions[0]]);

  it('has bots choose at once when the selection opens, with no move delay', async () => {
    const { runner, scheduler } = setup({ kinds: ['human', 'bot', 'bot'] });
    await scheduler.advance(0);
    expect(runner.state.generalSelection?.candidates).not.toHaveProperty('seat-1');
    expect(runner.state.generalSelection?.candidates).not.toHaveProperty('seat-2');
    expect(runner.state.generalSelection?.candidates).toHaveProperty('seat-0');
  });

  it('runs one clock for every human, which one seat confirming does not restart', async () => {
    const { runner, scheduler } = two();
    const first = runner.updateFor('p0', 0)!.clock!;
    await scheduler.advance(100_000);
    await pick(runner, 'p0');
    const second = runner.updateFor('p1', 0)!.clock!;
    expect(second).toMatchObject({ kind: 'selection', endsAt: first.endsAt, totalSeconds: 300 });
  });

  it("sends every seat the same clock with the viewer's own seat id", () => {
    const { runner } = two();
    const a = runner.updateFor('p0', 0)!.clock!;
    const b = runner.updateFor('p1', 0)!.clock!;
    expect([a.seatId, b.seatId]).toEqual(['seat-0', 'seat-1']);
    expect({ ...a, seatId: '' }).toEqual({ ...b, seatId: '' });
  });

  it('defaults a seat still choosing at 300 s and leaves a ready seat alone', async () => {
    const { runner, host, scheduler } = two();
    await pick(runner, 'p0');
    await scheduler.advance(300_000);
    expect(host.stored.map((r) => [r.seatId, r.source])).toEqual([['seat-0', 'human'], ['seat-1', 'timeout']]);
    expect(runner.state.phase).not.toBe('GeneralSelection');
  });

  it('starts no new selection clock for the seats left after a timeout', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['human', 'human', 'human'], connected: ['p0', 'p1', 'p2'] });
    await scheduler.advance(300_000);
    expect(host.stored.map((r) => r.source)).toEqual(['timeout', 'timeout', 'timeout']);
    expect(host.stored.map((r) => r.seatId)).toEqual(['seat-0', 'seat-1', 'seat-2']);
    expect(runner.state.generalSelection).toBeNull();
  });

  it('refuses a choice that loses a race to the timeout, and stores nothing twice', async () => {
    const { runner, host, scheduler } = two();
    const late = runner.updateFor('p1', 0)!.legalActions[0];
    await scheduler.advance(300_000);
    await expect(runner.submit('p1', GAME_ID, 0, [late])).rejects.toEqual(expect.objectContaining({ code: expect.stringMatching(/illegal_action|stale/) }));
    expect(host.stored).toHaveLength(2);
  });

  it('has a taken-over seat choose at once', async () => {
    const { runner, host, scheduler } = two({ connected: ['p0'] });
    await scheduler.advance(TAKEOVER_AWAY_MS);
    runner.tick();
    await scheduler.advance(0);
    expect(host.stored.map((r) => [r.seatId, r.source])).toEqual([['seat-1', 'takeover']]);
  });

  it('does not count a selection timeout towards takeover', async () => {
    const { runner, host, scheduler } = two({ connected: ['p0'] });
    runner.disconnected('p1');
    await scheduler.advance(300_000);
    expect(host.seatsChangedCount).toBe(0);
    expect(host.stored.filter((r) => r.source === 'timeout').map((r) => r.seatId).sort()).toEqual(['seat-0', 'seat-1']);
  });

  describe('the 3 second start hold', () => {
    const held = async () => {
      const t = two({ startHoldMs: 3000 });
      await pick(t.runner, 'p0');
      await pick(t.runner, 'p1');
      return t;
    };

    it('offers nobody actions for 3 seconds, then the first decision', async () => {
      const { runner, scheduler } = await held();
      expect([runner.updateFor('p0', 0)!.legalActions, runner.updateFor('p1', 0)!.legalActions]).toEqual([[], []]);
      await scheduler.advance(2_999);
      expect(runner.updateFor('p0', 0)!.legalActions).toEqual([]);
      await scheduler.advance(1);
      expect(runner.updateFor('p0', 0)!.legalActions.length).toBeGreaterThan(0);
    });

    it('refuses a move during the hold as not_your_turn', async () => {
      const { runner } = await held();
      const move: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
      await expect(runner.submit('p0', GAME_ID, runner.seq, [move])).rejects.toEqual(code('not_your_turn'));
    });

    it("starts the first decision's clock at the end of the hold", async () => {
      const { runner } = await held();
      const clock = runner.updateFor('p0', 0)!.clock!;
      expect(clock.startsAt - clock.serverNow).toBe(3000);
    });

    it('still reports the time left to a snapshot taken during the hold', async () => {
      const { runner, scheduler } = await held();
      await scheduler.advance(1_000);
      const clock = runner.updateFor('p1', 0)!.clock!;
      expect(clock.startsAt - clock.serverNow).toBe(2000);
    });

    it('starts a bot first mover after the hold, and reports it', async () => {
      const t = setup({ kinds: ['bot', 'human'], connected: ['p1'], startHoldMs: 3000 });
      await t.scheduler.advance(0);
      await pick(t.runner, 'p1');
      const clock = t.runner.updateFor('p1', 0)!.clock!;
      expect(clock).toMatchObject({ bot: true });
      expect(clock.startsAt - clock.serverNow).toBe(3000);
      const before = t.host.stored.length;
      await t.scheduler.advance(3000 + BOT_DELAY_MS - 1);
      expect(t.host.stored).toHaveLength(before);
    });

    it('applies the hold when only bots and taken-over seats are playing', async () => {
      const t = setup({ kinds: ['bot', 'bot'], connected: [], startHoldMs: 3000 });
      await t.scheduler.advance(0);
      expect(t.runner.state.phase).not.toBe('GeneralSelection');
      const before = t.host.stored.length;
      await t.scheduler.advance(2_999);
      expect(t.host.stored).toHaveLength(before);
      await t.scheduler.advance(BOT_DELAY_MS + 1);
      expect(t.host.stored.length).toBeGreaterThan(before);
    });
  });
});

describe('GameRunner', () => {
  it("starts the first decision on its human seat's clock, offering moves to that seat only", () => {
    const { runner } = setup();
    const update = runner.updateFor('p0', 0)!;
    expect(update.clock).toEqual({ seatId: 'seat-0', kind: 'selection', startsAt: T0, endsAt: T0 + 300_000, totalSeconds: 300, serverNow: T0 });
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
    await expect(runner.submit('p0', 'aaaaaaaa-0000-4000-8000-000000000002', 0, [move])).rejects.toEqual(code('stale'));
    const later = setup({ state: pastSelection });
    const [play] = later.legal();
    await expect(later.runner.submit('p0', GAME_ID, 1, [play])).rejects.toEqual(code('stale'));
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
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'], state: pastSelection });
    expect(runner.updateFor('p1', 0)!.clock).toEqual({ seatId: 'seat-0', kind: 'play', startsAt: T0, endsAt: T0 + BOT_DELAY_MS, totalSeconds: BOT_DELAY_MS / 1000, serverNow: T0, bot: true });
    await scheduler.advance(BOT_DELAY_MS - 1);
    expect(host.stored).toHaveLength(0);
    await scheduler.advance(1);
    expect(host.stored[0]).toMatchObject({ seq: 1, seatId: 'seat-0', source: 'bot' });
  });

  it("submits the engine's default when the clock runs out", async () => {
    const { runner, host, scheduler } = setup({ state: pastSelection });
    const opening = runner.state;
    await scheduler.advance(180_000);
    expect(host.stored[0]).toMatchObject({ seq: 1, seatId: 'seat-0', source: 'timeout', action: defaultActionsFor(opening, getLegalActions(opening, 'seat-0', registry))[0] });
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
    const stored = host.stored.length;
    runner.disconnected('p0');
    expect(runner.paused).toBe(true);
    expect(scheduler.pending).toBe(0);
    expect(runner.updateFor('p0', 0)).toMatchObject({ paused: true, clock: null, legalActions: [] });
    await scheduler.advance(3_600_000);
    expect(host.stored).toHaveLength(stored);
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
    // A bot chooses its Generals at once; the retry waits, so a failing store is not hammered.
    await scheduler.advance(0);
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
    const { runner, host, scheduler } = setup({ connected: [], state: pastSelection });
    host.failPersist = true;
    await scheduler.runUntil(() => host.errors.length > 0);
    host.failPersist = false;
    await scheduler.runUntil(() => host.stored.length > 0);
    expect(host.stored).toEqual([expect.objectContaining({ seq: 1, seatId: 'seat-0', source: 'timeout' })]);
    expect(runner.botControlled('p0')).toBe(false);
    expect(host.seatsChangedCount).toBe(0);
  });
});

// A settled judgment (the judgmentNotice rule): the runner is moved into a state that waits for the acknowledgement,
// as if a judgment had just turned its card up. The runner's own fields are set directly: reaching one by play would
// take a game of luck.
// `rounds`: how many skills that may change the card were asked before it settled.
function settle(runner: GameRunner, rounds = 0): void {
  const judged = { instanceId: 'judged-1', definitionId: 'sha', suit: 'heart' as const, rank: 5 };
  const lightning = { instanceId: 'lightning-1', definitionId: 'lightning', suit: 'spade' as const, rank: 1 };
  const base = runner.state;
  const generalIds = [...registry.generals.keys()];
  const state: GameState = {
    ...base,
    phase: 'Play',
    generalSelection: null,
    // Revealed seats of different kingdoms, so the game goes on after the judgment.
    seats: base.seats.map((seat, i) => ({
      ...seat,
      kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[i % 4],
      generals: { main: { generalDefinitionId: generalIds[2 * i], revealed: true }, deputy: { generalDefinitionId: generalIds[2 * i + 1], revealed: true } },
    })),
    rules: { judgmentNotice: true },
    zones: base.zones.map((z) => (z.kind === 'processing' ? { ...z, cards: [judged] } : z)),
    judgmentView: { seatId: 'seat-0', reader: { kind: 'card', card: usedCardOf(lightning) }, card: judged, changes: [], settled: true, rounds },
  };
  const inner = runner as unknown as { state: GameState; reschedule(): void };
  inner.state = state;
  inner.reschedule();
}

describe('GameRunner: a settled judgment', () => {
  const ack = (seatId: string, extra: object = {}) => ({ kind: 'AcknowledgeJudgmentAction', seatId, ...extra });

  it('runs the 3 second notice clock while a person plays, and acknowledges by timeout', async () => {
    const { runner, host, scheduler } = setup();
    settle(runner);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', kind: 'notice', totalSeconds: 3 });
    await scheduler.advance(JUDGMENT_LEAD_IN_MS.head + JUDGMENT_LEAD_IN_MS.tail + 2_999);
    expect(host.stored).toHaveLength(0);
    await scheduler.advance(1);
    expect(host.stored).toEqual([expect.objectContaining({ seatId: 'seat-0', source: 'timeout', action: ack('seat-0', { timeout: true }) })]);
    expect(runner.state).not.toHaveProperty('judgmentView');
  });

  it("starts the countdown after the animation: the whole sequence when no skill was asked, only the verdict's tail after one was", () => {
    const none = setup();
    settle(none.runner);
    const noneClock = none.runner.updateFor('p0', 0)!.clock!;
    expect(noneClock.startsAt - noneClock.serverNow).toBe(JUDGMENT_LEAD_IN_MS.head + JUDGMENT_LEAD_IN_MS.tail);
    expect(noneClock.endsAt - noneClock.startsAt).toBe(3_000);
    const asked = setup();
    settle(asked.runner, 2);
    const askedClock = asked.runner.updateFor('p0', 0)!.clock!;
    expect(askedClock.startsAt - askedClock.serverNow).toBe(JUDGMENT_LEAD_IN_MS.tail);
  });

  it('has no lead-in in a game with no person playing: the bot closes it after its normal delay', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'bot'], connected: [] });
    settle(runner);
    const clock = runner.updateFor('p0', 0)!.clock!;
    expect(clock.bot).toBe(true);
    expect(clock.endsAt - clock.serverNow).toBe(BOT_DELAY_MS);
    await scheduler.advance(BOT_DELAY_MS);
    expect(runner.state).not.toHaveProperty('judgmentView');
    expect(host.stored[0]).toMatchObject({ action: ack('seat-0') });
  });

  it("flags a bot's move timer as a bot's in the clock, and a person's clock not", () => {
    const bots = setup({ kinds: ['bot', 'bot'], connected: [] });
    settle(bots.runner);
    expect(bots.runner.updateFor('p0', 0)!.clock).toMatchObject({ kind: 'notice', bot: true });
    const person = setup();
    settle(person.runner);
    const clock = person.runner.updateFor('p0', 0)!.clock!;
    expect(clock).toMatchObject({ kind: 'notice' });
    expect(clock).not.toHaveProperty('bot');
  });

  it('is not closed by a bot while another human plays, though the first human is bot-played', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['human', 'human'], connected: ['p0', 'p1'] });
    runner.disconnected('p0');
    await scheduler.advance(TAKEOVER_AWAY_MS);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(true);
    const before = host.stored.length;
    settle(runner);
    expect(runner.updateFor('p1', 0)!.clock).toMatchObject({ seatId: 'seat-0', kind: 'notice', totalSeconds: 3 });
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toHaveLength(before);
    // The person at the table closes it once the animation and the 3 s countdown have played.
    await scheduler.advance(JUDGMENT_LEAD_IN_MS.head + JUDGMENT_LEAD_IN_MS.tail + 3_000 - BOT_DELAY_MS);
    expect(host.stored[before]).toMatchObject({ seatId: 'seat-0', source: 'timeout', action: ack('seat-0', { timeout: true }) });
  });

  it('a notice timeout does not count towards takeover', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    for (let i = 0; i < 3; i++) {
      settle(runner);
      const before = host.stored.length;
      await scheduler.advance(10_000);
      expect(host.stored[before]).toMatchObject({ source: 'timeout', action: ack('seat-0', { timeout: true }) });
    }
    expect(runner.botControlled('p0')).toBe(false);
    expect(host.seatsChangedCount).toBe(0);
  });

  it('with every human away but not yet taken over, the clock still closes it', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['human', 'human'], connected: [] });
    settle(runner);
    await scheduler.advance(10_000);
    expect(host.stored[0]).toMatchObject({ source: 'timeout', action: ack('seat-0', { timeout: true }) });
    expect(runner.botControlled('p0') || runner.botControlled('p1')).toBe(false);
  });

  it('with no person playing, a bot closes it after the bot delay', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    runner.disconnected('p0');
    await scheduler.advance(TAKEOVER_AWAY_MS);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(true);
    const before = host.stored.length;
    settle(runner);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored[before]).toMatchObject({ seatId: 'seat-0', source: 'takeover', action: ack('seat-0') });
    expect(runner.state).not.toHaveProperty('judgmentView');
  });

  it('a game of bots only closes it after the bot delay', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'bot'], connected: [] });
    settle(runner);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored[host.stored.length - 1]).toMatchObject({ seatId: 'seat-0', source: 'bot', action: ack('seat-0') });
  });
});

describe('GameRunner: closing a settled judgment', () => {
  const close = (seatId: string) => ({ kind: 'AcknowledgeJudgmentAction', seatId }) as Action;
  const twoHumans = () => setup({ kinds: ['human', 'human'], connected: ['p0', 'p1'] });

  it('any person-controlled seat can close it, as the acting seat, with by', async () => {
    const { runner, host } = twoHumans();
    settle(runner);
    await runner.submit('p1', GAME_ID, 0, [close('seat-1')]);
    expect(host.stored).toEqual([
      expect.objectContaining({ seq: 1, seatId: 'seat-1', source: 'human', action: { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0', by: 'seat-1' }, stateHash: stateHash(runner.state) }),
    ]);
    expect(runner.state).not.toHaveProperty('judgmentView');
    expect(runner.state.log.find((e) => e.kind === 'JudgmentAcknowledgedEvent')).toEqual({ kind: 'JudgmentAcknowledgedEvent', seatId: 'seat-0', by: 'seat-1', source: 'close' });
  });

  it('the acting seat closing it records itself as by', async () => {
    const { runner, host } = twoHumans();
    settle(runner);
    await runner.submit('p0', GAME_ID, 0, [close('seat-0')]);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', action: { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0', by: 'seat-0' } });
  });

  it('ignores a seatId or by the client made up', async () => {
    const { runner, host } = twoHumans();
    settle(runner);
    await runner.submit('p1', GAME_ID, 0, [{ ...close('seat-0'), by: 'seat-0' } as Action]);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-1', action: { seatId: 'seat-0', by: 'seat-1' } });
  });

  it('offers the close to every person-controlled seat, and to no bot seat', () => {
    const { runner } = setup({ kinds: ['human', 'human', 'bot'], connected: ['p0', 'p1'] });
    settle(runner);
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([close('seat-0')]);
    expect(runner.updateFor('p1', 0)!.legalActions).toEqual([close('seat-1')]);
    expect(runner.updateFor('p2', 0)!.legalActions).toEqual([]);
  });

  it('refuses a bot-played seat, an eliminated seat, a wrong kind and extra actions', async () => {
    const { runner, host, scheduler } = twoHumans();
    runner.disconnected('p0');
    await scheduler.advance(TAKEOVER_AWAY_MS);
    runner.tick();
    const before = host.stored.length;
    settle(runner);
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([]);
    await expect(runner.submit('p0', GAME_ID, runner.seq, [close('seat-0')])).rejects.toEqual(code('not_your_turn'));
    await expect(runner.submit('p1', GAME_ID, runner.seq, [{ kind: 'EndPhaseAction', seatId: 'seat-1' }])).rejects.toEqual(code('not_your_turn'));
    await expect(runner.submit('p1', GAME_ID, runner.seq, [close('seat-1'), close('seat-1')])).rejects.toEqual(code('not_your_turn'));
    const inner = runner as unknown as { state: GameState };
    inner.state = { ...runner.state, seats: runner.state.seats.map((s) => (s.id === 'seat-1' ? { ...s, eliminated: true } : s)) };
    await expect(runner.submit('p1', GAME_ID, runner.seq, [close('seat-1')])).rejects.toEqual(code('not_your_turn'));
    expect(runner.updateFor('p1', 0)!.legalActions).toEqual([]);
    expect(host.stored).toHaveLength(before);
  });

  it('refuses a stale baseSeq', async () => {
    const { runner } = twoHumans();
    settle(runner);
    await expect(runner.submit('p1', GAME_ID, 5, [close('seat-1')])).rejects.toEqual(code('stale'));
  });

  it('a second close is refused, never a second acknowledgement', async () => {
    const { runner, host } = twoHumans();
    settle(runner);
    await runner.submit('p1', GAME_ID, 0, [close('seat-1')]);
    await expect(runner.submit('p0', GAME_ID, 0, [close('seat-0')])).rejects.toEqual(code('stale'));
    await expect(runner.submit('p0', GAME_ID, runner.seq, [close('seat-0')])).rejects.toEqual(expect.objectContaining({ code: expect.stringMatching(/not_your_turn|illegal_action/) }));
    expect(host.stored.filter((a) => a.action.kind === 'AcknowledgeJudgmentAction')).toHaveLength(1);
  });

  it('a close that loses the race to the timeout is stale', async () => {
    const { runner, host, scheduler } = twoHumans();
    settle(runner);
    const seq = runner.seq;
    await scheduler.advance(10_000);
    expect(host.stored[0]).toMatchObject({ source: 'timeout' });
    await expect(runner.submit('p1', GAME_ID, seq, [close('seat-1')])).rejects.toEqual(code('stale'));
  });
});

// Alternate Sorrow: the dead Cai Wenji's player (seat-0, eliminated) picks which of the killer seat-1's
// Generals loses its skills. The first time online that the acting seat is an eliminated one.
describe('a choice owned by an eliminated human seat', () => {
  const afterDeath = (opening: GameState): GameState => {
    const generals: Record<string, [string, string]> = { 'seat-0': ['alternate:cai-wenji', 'alternate:diao-chan'], 'seat-1': ['zhang-he', 'liu-shan'], 'seat-2': ['alternate:jia-xu', 'alternate:zhen-ji'] };
    const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'alternate:sorrow' };
    return {
      ...opening,
      phase: 'Play',
      generalSelection: null,
      turn: { ...opening.turn, ownerSeatId: 'seat-1' },
      seats: opening.seats.map((seat) => ({
        ...seat,
        kingdom: seat.id === 'seat-1' ? 'Wei' : 'Qun',
        generals: { main: { generalDefinitionId: generals[seat.id][0], revealed: true }, deputy: { generalDefinitionId: generals[seat.id][1], revealed: true } },
        ...(seat.id === 'seat-0' ? { eliminated: true, combinedHp: 0 } : {}),
      })),
      pendingChoice: {
        id: 'sorrow-1', seatId: 'seat-0', verb: 'pick', secret: true,
        reason: { kind: 'ability', owner, abilityId: owner.skillId, targetSeatId: 'seat-1' },
        options: (['main', 'deputy'] as const).map((slot) => ({
          id: slot,
          shows: { kind: 'label' as const, text: slot === 'main' ? 'Main General' : 'Deputy General' },
          effects: [{ kind: 'SilenceSeatEffect' as const, seatId: 'seat-1', slot }],
        })),
      },
    };
  };
  const dead = (options: Parameters<typeof setup>[0] = {}) => setup({ kinds: ['human', 'human', 'bot'], connected: ['p0', 'p1'], state: afterDeath, ...options });
  const silenced = (runner: GameRunner) => runner.state.seats.find((s) => s.id === 'seat-1')!.silencedSlots;

  it('offers the dead player the Main General and Deputy General options, and no one else anything', () => {
    const { runner } = dead();
    expect(getActiveSeatId(runner.state)).toBe('seat-0');
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([
      { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'sorrow-1', optionId: 'main' },
      { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'sorrow-1', optionId: 'deputy' },
    ]);
    expect(runner.updateFor('p1', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', kind: 'pick' });
  });

  it('accepts their pick, and the game moves on to the turn owner', async () => {
    const { runner, host, legal } = dead();
    const deputy = legal().find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'deputy')!;
    await runner.submit('p0', GAME_ID, 0, [deputy]);
    expect(runner.seq).toBe(1);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', source: 'human', action: deputy });
    expect(runner.state.pendingChoice).toBeUndefined();
    expect(silenced(runner)).toEqual(['deputy']);
    expect(getActiveSeatId(runner.state)).toBe('seat-1');
  });

  it('a clock timeout picks the default option', async () => {
    const { runner, host, scheduler } = dead();
    await scheduler.advance(300_000);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', source: 'timeout', action: { optionId: 'main' } });
    expect(silenced(runner)).toEqual(['main']);
    expect(host.broken).toBeNull();
  });

  it('a bot picks for a dead player who left the room', async () => {
    const { runner, host, scheduler } = dead({ connected: ['p1'], left: ['p0'] });
    expect(runner.isBotPlayed('seat-0')).toBe(true);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', source: 'takeover', action: { kind: 'ChooseOptionAction', choiceId: 'sorrow-1' } });
    expect(silenced(runner)).toHaveLength(1);
    expect(host.broken).toBeNull();
  });
});

// A judgment that is still open, with `seatId` asked whether a skill of its may change the card.
function askToChange(runner: GameRunner, seatId: string, rounds: number): void {
  settle(runner, rounds);
  const inner = runner as unknown as { state: GameState; reschedule(): void };
  const owner = { kind: 'general' as const, seatId, slot: 'main' as const, skillId: 'devil' };
  inner.state = {
    ...inner.state,
    judgmentView: { ...inner.state.judgmentView!, settled: false },
    pendingChoice: {
      id: `ask-devil-${seatId}`, seatId, reason: { kind: 'ability', owner, abilityId: 'devil', targetSeatId: 'seat-0' }, verb: 'use',
      options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
      judgmentChange: true,
    },
  };
  inner.reschedule();
}

describe('GameRunner: a skill that may change the judgment', () => {
  it("gives a person's decision 15 seconds, after the card has been shown, and declines when they run out", async () => {
    const { runner, host, scheduler } = setup();
    askToChange(runner, 'seat-0', 1);
    const clock = runner.updateFor('p0', 0)!.clock!;
    expect(clock).toMatchObject({ seatId: 'seat-0', kind: 'judgmentChange', totalSeconds: 15 });
    expect(clock.startsAt - clock.serverNow).toBe(JUDGMENT_LEAD_IN_MS.head);
    await scheduler.advance(JUDGMENT_LEAD_IN_MS.head + 14_999);
    expect(host.stored).toHaveLength(0);
    await scheduler.advance(1);
    expect(host.stored).toEqual([expect.objectContaining({ seatId: 'seat-0', source: 'timeout', action: expect.objectContaining({ kind: 'ChooseOptionAction', optionId: 'decline' }) })]);
  });

  it('waits the replacement animation before a later ask starts its clock', () => {
    const { runner } = setup();
    askToChange(runner, 'seat-0', 2);
    const clock = runner.updateFor('p0', 0)!.clock!;
    expect(clock.startsAt - clock.serverNow).toBe(JUDGMENT_LEAD_IN_MS.replace);
  });

  it("has a bot's decision wait for the animation too while a person is at the table", async () => {
    const { runner, host, scheduler } = setup({ kinds: ['human', 'bot'] });
    askToChange(runner, 'seat-1', 1);
    await scheduler.advance(JUDGMENT_LEAD_IN_MS.head + BOT_DELAY_MS - 1);
    expect(host.stored).toHaveLength(0);
    await scheduler.advance(1);
    expect(host.stored).toHaveLength(1);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-1', source: 'bot' });
  });

  it('does not hold up a game with no person playing', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'bot'], connected: [] });
    askToChange(runner, 'seat-1', 1);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toHaveLength(1);
  });
});
