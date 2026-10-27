import { TestBed } from '@angular/core/testing';
import { finalSeatViews } from 'protocol';
import type { GameUpdate, RoomSnapshot } from 'protocol';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, GAME_ID, gameUpdates, LAST_GAME, PLAYING, ROOM, welcome } from './testing';
import { english } from '../i18n/msg.testing';

describe('RemoteGameService', () => {
  let socket: FakeSocket;
  let game: RemoteGameService;
  const [opening, afterMove] = gameUpdates();
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    game = TestBed.inject(RemoteGameService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
  });

  it('has no game until one arrives', () => {
    socket.serverSends(welcome(ROOM));
    expect(game.state()).toBeNull();
    expect(game.legalActions()).toEqual([]);
    expect(game.playing()).toBe(false);
  });

  it("builds the board's state from the welcome's game: the view, the full log and your seat", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    expect(game.state()).toEqual({ ...opening.view, log: opening.events, rng: { seed: 0, counter: 0 } });
    expect(game.visibleState()).toBe(game.state());
    expect(game.humanSeatId()).toBe('seat-0');
    expect(game.revealedSeatId()).toBe('seat-0');
    expect(game.activeSeatId()).toBe('seat-0');
    expect(game.legalActions()).toEqual(opening.legalActions);
    expect(game.mode()).toBe('pass-and-play');
    expect(game.playing()).toBe(true);
  });

  it("appends each update's events to the log, and asks for a resync when some are missing", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverSends({ type: 'game.update', game: afterMove });
    expect(game.state()!.log).toEqual([...opening.events, ...afterMove.events]);
    expect(game.activeSeatId()).toBe('seat-1');
    const before = game.state();
    socket.serverSends({ type: 'game.update', game: { ...afterMove, seq: 2, logFrom: afterMove.logFrom + afterMove.events.length + 5 } });
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    expect(game.state()).toBe(before);
  });

  it('starts the log afresh for a new game', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverSends({ type: 'game.update', game: afterMove });
    socket.serverSends({ type: 'game.update', game: { ...opening, gameId: 'another-game' } });
    expect(game.state()!.log).toEqual(opening.events);
  });

  it('sends a move as one game.submit with the game and seq it saw, and offers no moves until answered', async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    const [first, second] = opening.legalActions;
    game.submitAll([first, second]);
    expect(socket.lastSent).toEqual({ type: 'game.submit', gameId: GAME_ID, baseSeq: 0, actions: [first, second], reqId: expect.any(String) });
    expect(game.legalActions()).toEqual([]);
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await flush();
    expect(game.legalActions()).toEqual(opening.legalActions);
    game.submit(first);
    expect(socket.lastSent).toMatchObject({ type: 'game.submit', actions: [first] });
  });

  it("shows a refused move's message, and resyncs after a stale one", async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    game.submit({ kind: 'EndPhaseAction', seatId: 'seat-0' });
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'stale', message: 'The game moved on. Try again' });
    await flush();
    expect(english(game.lastError())).toBe('The game moved on. Try again');
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    game.clearError();
    expect(game.lastError()).toBeNull();
  });

  describe('General Selection, all at once', () => {
    const twoSeats = (): RoomSnapshot => PLAYING;

    it("lists every seat as Choosing or Ready from the candidates' keys", () => {
      socket.serverSends(welcome(twoSeats(), 'p-ann', opening));
      expect(game.selectionRoster()).toEqual([
        { seatId: 'seat-0', ready: false, isYou: true },
        { seatId: 'seat-1', ready: false, isYou: false },
      ]);
      socket.serverSends({ type: 'game.update', game: afterMove });
      expect(game.selectionRoster()).toEqual([
        { seatId: 'seat-0', ready: true, isYou: true },
        { seatId: 'seat-1', ready: false, isYou: false },
      ]);
    });

    it('shows a bot seat, and a taken-over seat, as Ready from the start', () => {
      const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
      socket.serverSends(welcome(takenOver, 'p-ann', opening));
      expect(game.selectionRoster()!.map((row) => row.ready)).toEqual([false, true]);
    });

    it('has no roster once the Generals are chosen', () => {
      const [, , started] = gameUpdates(true);
      socket.serverSends(welcome(PLAYING, 'p-ann', started));
      expect(game.selectionRoster()).toBeNull();
    });

    it("makes your own seat the active one while you are choosing, even when an earlier seat is too", () => {
      socket.serverSends(welcome(PLAYING, 'p-bo', { ...opening, view: { ...opening.view } }));
      expect(game.humanSeatId()).toBe('seat-1');
      expect(game.activeSeatId()).toBe('seat-1');
    });

    it('says when the game starts while turn 1 waits for its first decision, and not otherwise', () => {
      const [, , started, now] = gameUpdates(true);
      socket.serverSends(welcome(PLAYING, 'p-ann', { ...started, clock: { seatId: 'seat-0', kind: 'start', startsAt: now + 3000, endsAt: now + 23000, totalSeconds: 20, serverNow: now } }));
      expect(game.gameStartsAt()).toBeGreaterThan(Date.now() + 2000);
      socket.serverSends({ type: 'game.update', game: { ...started, seq: started.seq + 1, logFrom: started.events.length, events: [], clock: { seatId: 'seat-0', kind: 'start', startsAt: now, endsAt: now + 20000, totalSeconds: 20, serverNow: now } } });
      expect(game.gameStartsAt()).toBeNull();
    });

    it('does not mistake a turn-1 judgment lead-in for the start hold', () => {
      const [, , started, now] = gameUpdates(true);
      for (const kind of ['judgmentChange', 'notice'] as const) {
        socket.serverSends(welcome(PLAYING, 'p-ann', { ...started, clock: { seatId: 'seat-0', kind, startsAt: now + 4100, endsAt: now + 7100, totalSeconds: 3, serverNow: now } }));
        expect(game.gameStartsAt()).toBeNull();
      }
    });

    it("says when the game starts when a bot moves first", () => {
      const [, , started, now] = gameUpdates(true);
      socket.serverSends(welcome(PLAYING, 'p-ann', { ...started, clock: { seatId: 'seat-1', kind: 'play', startsAt: now + 3000, endsAt: now + 4500, totalSeconds: 1.5, serverNow: now, bot: true } }));
      expect(game.gameStartsAt()).toBeGreaterThan(Date.now() + 2000);
    });

    it('asks for no message when a General choice loses a race, and resyncs quietly', async () => {
      socket.serverSends(welcome(PLAYING, 'p-ann', opening));
      game.submit(opening.legalActions[0]);
      socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'stale', message: 'The game moved on. Try again' });
      await flush();
      expect(game.lastError()).toBeNull();
      expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    });

    it('has no start time during General Selection', () => {
      socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-0', kind: 'selection', startsAt: 0, endsAt: 300_000, totalSeconds: 300, serverNow: 0 } }));
      expect(game.gameStartsAt()).toBeNull();
    });
  });

  it('offers no moves while the socket is down', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverCloses();
    expect(game.legalActions()).toEqual([]);
  });

  it("counts bot seats and taken-over seats as bots, and a clock on one as that bot's thinking", () => {
    const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    // A welcome carries the whole log.
    const events = [...opening.events, ...afterMove.events];
    socket.serverSends(welcome(takenOver, 'p-ann', { ...afterMove, logFrom: 0, events }));
    expect(game.botSeatIds()).toEqual(['seat-1']);
    expect(game.botThinkingSeatId()).toBeNull();
    socket.serverSends({ type: 'game.update', game: { ...afterMove, logFrom: events.length, events: [], clock: { seatId: 'seat-1', kind: 'selection', startsAt: 0, endsAt: 700, totalSeconds: 0.7, serverNow: 0 } } });
    expect(game.botThinkingSeatId()).toBe('seat-1');
  });

  it("ends with the final state's result, then the room's last game, until dismissed", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    const final: GameUpdate = { ...afterMove, view: { ...afterMove.view, result: LAST_GAME.result } };
    socket.serverSends({ type: 'game.update', game: final });
    // Each seat as the final view shows it.
    expect(game.ending()).toEqual({ ...LAST_GAME, finalSeats: finalSeatViews(final.view) });
    expect(game.ending()!.finalSeats.map((s) => s.seatId)).toEqual(['seat-0', 'seat-1']);
    expect(game.playing()).toBe(false);
    socket.serverSends({ type: 'room.updated', room: { ...ROOM, lastGame: LAST_GAME } });
    expect(game.ending()).toEqual(LAST_GAME);
    game.dismiss();
    expect(game.ending()).toBeNull();
  });
});

describe('RemoteGameService: a settled judgment', () => {
  let socket: FakeSocket;
  let game: RemoteGameService;
  const [opening] = gameUpdates();
  const judged = { instanceId: 'j1', definitionId: 'sha', suit: 'heart' as const, rank: 5 };
  const settled: GameUpdate = {
    ...opening,
    view: { ...opening.view, judgmentView: { seatId: 'seat-1', reader: { kind: 'card', card: { as: 'lightning', physical: [], colour: 'black', suit: 'spade', rank: 1 } as never }, card: judged, changes: [], settled: true, rounds: 0 } },
    legalActions: [{ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    game = TestBed.inject(RemoteGameService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
  });

  it("closeJudgment submits the offered acknowledgement for the member's own seat, with the update's seq", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', settled));
    expect(game.judgmentSettled()).toBe(true);
    game.closeJudgment();
    expect(socket.lastSent).toEqual({ type: 'game.submit', gameId: GAME_ID, baseSeq: 0, actions: [{ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0' }], reqId: expect.any(String) });
  });

  it('canCloseJudgment follows the server’s offer', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', settled));
    expect(game.canCloseJudgment()).toBe(true);
    socket.serverSends({ type: 'game.update', game: { ...settled, seq: 1, logFrom: opening.events.length, events: [], legalActions: [] } });
    expect(game.canCloseJudgment()).toBe(false);
  });

  it('publicState is the state the server sent', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', settled));
    expect(game.publicState()).toBe(game.state());
  });

  it('a notice clock on a bot seat that a person is closing is not "thinking"', () => {
    const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    socket.serverSends(welcome(takenOver, 'p-ann', { ...settled, clock: { seatId: 'seat-1', kind: 'notice', startsAt: 0, endsAt: 10_000, totalSeconds: 10, serverNow: 0 } }));
    expect(game.botSeatIds()).toContain('seat-1');
    expect(game.botThinkingSeatId()).toBeNull();
  });

  it("a bot's own notice clock is \"thinking\"", () => {
    const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    socket.serverSends(welcome(takenOver, 'p-ann', { ...settled, clock: { seatId: 'seat-1', kind: 'notice', startsAt: 0, endsAt: 1_500, totalSeconds: 1.5, serverNow: 0, bot: true } }));
    expect(game.botThinkingSeatId()).toBe('seat-1');
  });

  it('a Close that lost a race to another Close or the clock is silent, and resyncs', async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', settled));
    game.closeJudgment();
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'stale', message: 'The game moved on. Try again' });
    await new Promise((resolve) => setTimeout(resolve));
    expect(game.lastError()).toBeNull();
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
  });

  it('a refused Close for another reason is shown', async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', settled));
    game.closeJudgment();
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'not_your_turn', message: "It's not your turn" });
    await new Promise((resolve) => setTimeout(resolve));
    expect(game.lastError()).not.toBeNull();
  });

  it('does nothing without a settled judgment, or when the server offers no close', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    expect(game.judgmentSettled()).toBe(false);
    const before = socket.lastSent;
    game.closeJudgment();
    expect(socket.lastSent).toBe(before);
    socket.serverSends({ type: 'game.update', game: { ...settled, seq: 1, logFrom: opening.events.length, events: [], legalActions: [] } });
    expect(game.judgmentSettled()).toBe(true);
    const sent = socket.lastSent;
    game.closeJudgment();
    expect(socket.lastSent).toBe(sent);
  });
});

describe('RemoteDecisionClock', () => {
  let socket: FakeSocket;
  const [opening, afterMove] = gameUpdates();

  afterEach(() => jest.useRealTimers());

  it("counts down the viewer's own clock in this device's time, and shows no other seat's", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    // The server's clock runs 4 000 s ahead of this device's: only the difference matters.
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-0', kind: 'selection', startsAt: 5_000_000, endsAt: 5_030_000, totalSeconds: 300, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(30);
    expect(clock.totalSeconds()).toBe(300);
    jest.advanceTimersByTime(10_000);
    expect(clock.secondsLeft()).toBe(20);
    socket.serverSends({ type: 'game.update', game: { ...afterMove, clock: { seatId: 'seat-1', kind: 'selection', startsAt: 5_000_000, endsAt: 5_100_000, totalSeconds: 300, serverNow: 5_000_000 } } });
    TestBed.tick();
    expect(clock.secondsLeft()).toBeNull();
    expect(clock.totalSeconds()).toBeNull();
  });
});

describe('RemoteDecisionClock: a notice clock', () => {
  let socket: FakeSocket;
  const [opening] = gameUpdates();

  afterEach(() => jest.useRealTimers());

  it("shows a settled judgment's countdown to every player, whichever seat the clock is on", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-1', kind: 'notice', startsAt: 5_000_000, endsAt: 5_010_000, totalSeconds: 10, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(10);
    expect(clock.totalSeconds()).toBe(10);
  });
});

describe('RemoteDecisionClock: a decision that waits for an animation', () => {
  let socket: FakeSocket;
  const [opening] = gameUpdates();

  afterEach(() => jest.useRealTimers());

  it("keeps the deciding seat's countdown at its full length until the lead-in has passed, and says how long that is", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    // The server's clock is 4 000 s ahead of this device's: only differences matter.
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-0', kind: 'judgmentChange', startsAt: 5_002_100, endsAt: 5_012_100, totalSeconds: 10, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.startsInMs()).toBe(2_100);
    expect(clock.secondsLeft()).toBe(10);
    expect(clock.totalSeconds()).toBe(10);
    jest.advanceTimersByTime(2_000);
    expect(clock.startsInMs()).toBe(100);
    expect(clock.secondsLeft()).toBe(10);
    // The display ticks every 250 ms.
    jest.advanceTimersByTime(1_250);
    expect(clock.startsInMs()).toBe(0);
    expect(clock.secondsLeft()).toBe(9);
  });

  it("shows a changer's clock to the deciding seat only, and the notice clock to everyone", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-1', kind: 'judgmentChange', startsAt: 5_000_000, endsAt: 5_010_000, totalSeconds: 10, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBeNull();
    socket.serverSends({ type: 'game.update', game: { ...opening, seq: 1, clock: { seatId: 'seat-1', kind: 'notice', startsAt: 5_000_000, endsAt: 5_003_000, totalSeconds: 3, serverNow: 5_000_000 } } });
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(3);
  });
});

describe('RemoteDecisionClock: a notice clock of a bot', () => {
  let socket: FakeSocket;
  const [opening] = gameUpdates();

  afterEach(() => jest.useRealTimers());

  it('shows no countdown', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-1', kind: 'notice', startsAt: 5_000_000, endsAt: 5_001_500, totalSeconds: 1.5, serverNow: 5_000_000, bot: true } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBeNull();
  });
});

