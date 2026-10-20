import { TestBed } from '@angular/core/testing';
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
    game.submit(opening.legalActions[0]);
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'stale', message: 'The game moved on. Try again' });
    await flush();
    expect(english(game.lastError())).toBe('The game moved on. Try again');
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    game.clearError();
    expect(game.lastError()).toBeNull();
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
    socket.serverSends({ type: 'game.update', game: { ...afterMove, logFrom: events.length, events: [], clock: { seatId: 'seat-1', kind: 'selection', endsAt: 700, totalSeconds: 0.7, serverNow: 0 } } });
    expect(game.botThinkingSeatId()).toBe('seat-1');
  });

  it("ends with the final state's result, then the room's last game, until dismissed", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    const final: GameUpdate = { ...afterMove, view: { ...afterMove.view, result: LAST_GAME.result } };
    socket.serverSends({ type: 'game.update', game: final });
    expect(game.ending()).toEqual(LAST_GAME);
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
    view: { ...opening.view, judgmentView: { seatId: 'seat-1', reader: { kind: 'card', card: { as: 'lightning', physical: [], colour: 'black', suit: 'spade', rank: 1 } as never }, card: judged, changes: [], settled: true } },
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
    socket.serverSends(welcome(takenOver, 'p-ann', { ...settled, clock: { seatId: 'seat-1', kind: 'notice', endsAt: 10_000, totalSeconds: 10, serverNow: 0 } }));
    expect(game.botSeatIds()).toContain('seat-1');
    expect(game.botThinkingSeatId()).toBeNull();
  });

  it("a bot's own notice clock is \"thinking\"", () => {
    const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    socket.serverSends(welcome(takenOver, 'p-ann', { ...settled, clock: { seatId: 'seat-1', kind: 'notice', endsAt: 1_500, totalSeconds: 1.5, serverNow: 0, bot: true } }));
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
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-0', kind: 'selection', endsAt: 5_030_000, totalSeconds: 300, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(30);
    expect(clock.totalSeconds()).toBe(300);
    jest.advanceTimersByTime(10_000);
    expect(clock.secondsLeft()).toBe(20);
    socket.serverSends({ type: 'game.update', game: { ...afterMove, clock: { seatId: 'seat-1', kind: 'selection', endsAt: 5_100_000, totalSeconds: 300, serverNow: 5_000_000 } } });
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
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-1', kind: 'notice', endsAt: 5_010_000, totalSeconds: 10, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(10);
    expect(clock.totalSeconds()).toBe(10);
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
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-1', kind: 'notice', endsAt: 5_001_500, totalSeconds: 1.5, serverNow: 5_000_000, bot: true } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBeNull();
  });
});

