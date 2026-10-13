import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { RoomSnapshot } from 'protocol';
import { LobbyService, NOTICE_MS } from './lobby.service';
import { OnlineNotice } from './online-notice';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, PLAYING, ROOM, welcome } from './testing';

describe('LobbyService', () => {
  let socket: FakeSocket;
  let lobby: LobbyService;
  let notices: OnlineNotice;
  let navigate: jest.SpyInstance;
  const withHost = (hostPlayerId: string): RoomSnapshot => ({ ...ROOM, hostPlayerId });
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SocketService,
        LobbyService,
        { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) },
        provideRouter([{ path: 'rooms', children: [] }]),
      ],
    });
    lobby = TestBed.inject(LobbyService);
    notices = TestBed.inject(OnlineNotice);
    navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');
    lobby.open(ROOM.id);
    socket.serverOpens();
  });

  it('shows the room and who you are after the welcome', () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    expect(lobby.room()).toEqual(ROOM);
    expect(lobby.you()).toBe('p-ann');
    expect(lobby.isHost()).toBe(true);
    expect(lobby.canAct()).toBe(true);
  });

  it('is not the host when someone else is', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.isHost()).toBe(false);
  });

  it('announces a new host', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    socket.serverSends({ type: 'room.updated', room: withHost('p-bo') });
    expect(lobby.notice()).toBe('Bo is now the host');
  });

  it('clears the host notice after a while', () => {
    jest.useFakeTimers();
    try {
      socket.serverSends(welcome(ROOM, 'p-bo'));
      socket.serverSends({ type: 'room.updated', room: withHost('p-bo') });
      expect(lobby.notice()).toBe('Bo is now the host');
      jest.advanceTimersByTime(NOTICE_MS - 1);
      expect(lobby.notice()).toBe('Bo is now the host');
      jest.advanceTimersByTime(1);
      expect(lobby.notice()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('says it is waiting for an away host', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.waitingForHost()).toBeNull();
    socket.serverSends({ type: 'room.updated', room: { ...ROOM, members: ROOM.members.map((m) => (m.playerId === 'p-ann' ? { ...m, connected: false } : m)) } });
    expect(lobby.waitingForHost()).toBe('Waiting for Ann to return…');
  });

  it("sends lobby commands, and shows the server's refusal", async () => {
    socket.serverSends(welcome());
    const added = lobby.addBot();
    expect(socket.lastSent).toEqual({ type: 'lobby.addBot', reqId: 'r1' });
    socket.serverSends({ type: 'ack', reqId: 'r1' });
    expect(await added).toBe(true);

    const removed = lobby.removePlayer('p-bo');
    expect(socket.lastSent).toEqual({ type: 'lobby.removePlayer', playerId: 'p-bo', reqId: 'r2' });
    socket.serverSends({ type: 'error', reqId: 'r2', code: 'not_host', message: 'Only the host can do that' });
    expect(await removed).toBe(false);
    expect(lobby.error()).toBe('Only the host can do that');

    void lobby.setRules(6, { firstRevealDraw: false });
    expect(socket.lastSent).toEqual({ type: 'lobby.setRules', seatCount: 6, rules: { firstRevealDraw: false }, reqId: 'r3' });
    void lobby.makeHost('p-bo');
    expect(socket.lastSent).toEqual({ type: 'lobby.makeHost', playerId: 'p-bo', reqId: 'r4' });
  });

  it('goes back to Rooms after leaving, and stops the socket', async () => {
    socket.serverSends(welcome());
    const left = lobby.leave();
    expect(socket.lastSent).toEqual({ type: 'room.leave', reqId: 'r1' });
    socket.serverSends({ type: 'ack', reqId: 'r1' });
    await left;
    expect(socket.closedByApp).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/rooms');
    expect(notices.take()).toBeNull();
  });

  it.each([
    ['removed', 'The host removed you from the room'],
    ['host_left', 'The host closed the room'],
    ['idle', 'The room closed after 30 minutes without activity'],
  ] as const)('when the room drops you (%s), Rooms shows why', async (reason, text) => {
    socket.serverSends(welcome());
    socket.serverSends({ type: 'room.left', reason });
    await flush();
    expect(notices.take()).toBe(text);
    expect(navigate).toHaveBeenCalledWith('/rooms');
  });

  it('says so when another tab took over', () => {
    socket.serverSends(welcome());
    socket.serverSends({ type: 'replaced' });
    expect(lobby.ended()).toBe('This room is open in another tab');
    expect(lobby.canAct()).toBe(false);
  });

  it('asks for a reload after a version error', () => {
    socket.serverSends({ type: 'error', code: 'version', message: 'Please reload to get the latest version' });
    expect(lobby.ended()).toBe('Please reload to get the latest version');
  });

  it('goes back to Rooms, saying why, when you are not a member', async () => {
    socket.serverSends({ type: 'error', code: 'not_member', message: "You're not in this room" });
    await flush();
    expect(notices.take()).toBe("You're not in this room");
    expect(navigate).toHaveBeenCalledWith('/rooms');
  });

  it('goes back to Rooms, saying why, when the server refuses the hello as malformed', async () => {
    socket.serverSends({ type: 'error', code: 'invalid_message', message: 'That request was not understood' });
    await flush();
    expect(notices.take()).toBe('That request was not understood');
    expect(navigate).toHaveBeenCalledWith('/rooms');
  });
  it('lets the host start the game, and a solo room its player', async () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    expect(lobby.canStart()).toBe(true);
    void lobby.start();
    expect(socket.lastSent).toMatchObject({ type: 'lobby.start' });
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.canStart()).toBe(false);
    socket.serverSends(welcome({ ...ROOM, visibility: 'solo', hostPlayerId: null }, 'p-bo'));
    expect(lobby.isSolo()).toBe(true);
    expect(lobby.canStart()).toBe(true);
    socket.serverSends({ type: 'room.updated', room: { ...PLAYING, visibility: 'solo', hostPlayerId: null } });
    expect(lobby.canStart()).toBe(false);
  });

  it('announces a player who takes their seat back from a bot', () => {
    const takenOver = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    socket.serverSends(welcome(takenOver, 'p-ann'));
    expect(lobby.notice()).toBeNull();
    socket.serverSends({ type: 'room.updated', room: PLAYING });
    expect(lobby.notice()).toBe('Bo is back');
  });
});
