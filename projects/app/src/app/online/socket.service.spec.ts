import { TestBed } from '@angular/core/testing';
import { PROTOCOL_VERSION } from 'protocol';
import type { ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RECONNECT_DELAYS_MS, SocketService, socketUrl, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, ROOM, welcome } from './testing';

describe('SocketService', () => {
  let sockets: FakeSocket[];
  let service: SocketService;
  const latest = () => sockets.at(-1)!;
  const connected = () => {
    service.connect(ROOM.id);
    latest().serverOpens();
    latest().serverSends(welcome());
  };

  beforeEach(() => {
    jest.useFakeTimers();
    sockets = [];
    TestBed.configureTestingModule({
      providers: [
        SocketService,
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: (url: string) => {
            const socket = new FakeSocket(url);
            sockets.push(socket);
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(SocketService);
  });
  afterEach(() => jest.useRealTimers());

  it('builds the socket URL from the page origin', () => {
    expect(socketUrl({ protocol: 'http:', host: 'localhost:4200' })).toBe('ws://localhost:4200/api/ws');
    expect(socketUrl({ protocol: 'https:', host: 'sanguosha.example' })).toBe('wss://sanguosha.example/api/ws');
  });

  it('says hello with the protocol version and the room, and is open after welcome', () => {
    service.connect(ROOM.id);
    expect(service.status()).toBe('connecting');
    latest().serverOpens();
    expect(latest().sent).toEqual([{ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: ROOM.id }]);
    latest().serverSends(welcome());
    expect(service.status()).toBe('open');
  });

  it('passes every server message on', () => {
    const seen: ServerMessage[] = [];
    service.messages.subscribe((m) => seen.push(m));
    connected();
    latest().serverSends({ type: 'room.updated', room: ROOM });
    expect(seen.map((m) => m.type)).toEqual(['welcome', 'room.updated']);
  });

  it('numbers requests, resolving on ack and rejecting with the error', async () => {
    connected();
    const added = service.request({ type: 'lobby.addBot' });
    expect(latest().lastSent).toEqual({ type: 'lobby.addBot', reqId: 'r1' });
    latest().serverSends({ type: 'ack', reqId: 'r1' });
    await expect(added).resolves.toBeUndefined();

    const refused = service.request({ type: 'lobby.addBot' });
    latest().serverSends({ type: 'error', reqId: 'r2', code: 'room_full', message: 'This room is full' });
    const err = await refused.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'room_full', message: 'This room is full' });
  });

  it('refuses a request while not open', async () => {
    service.connect(ROOM.id);
    await expect(service.request({ type: 'lobby.addBot' })).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects requests still waiting when the socket drops', async () => {
    connected();
    const pending = service.request({ type: 'lobby.addBot' });
    latest().serverCloses();
    await expect(pending).rejects.toMatchObject({ code: 'network' });
  });

  it('reconnects after 1 s, 2 s, 4 s, 8 s, then every 15 s, and starts over after a welcome', () => {
    connected();
    for (const delay of [...RECONNECT_DELAYS_MS, 15_000]) {
      const before = sockets.length;
      latest().serverCloses();
      expect(service.status()).toBe('reconnecting');
      jest.advanceTimersByTime(delay - 1);
      expect(sockets.length).toBe(before);
      jest.advanceTimersByTime(1);
      expect(sockets.length).toBe(before + 1);
      latest().serverOpens();
      expect(latest().lastSent).toMatchObject({ type: 'hello' });
    }
    latest().serverSends(welcome());
    expect(service.status()).toBe('open');
    const before = sockets.length;
    latest().serverCloses();
    jest.advanceTimersByTime(1_000);
    expect(sockets.length).toBe(before + 1);
  });

  it.each<[string, ServerMessage]>([
    ['replaced', { type: 'replaced' }],
    ['room.left', { type: 'room.left', reason: 'removed' }],
    ['a version error', { type: 'error', code: 'version', message: 'Please reload to get the latest version' }],
    ['an unasked invalid_message error', { type: 'error', code: 'invalid_message', message: 'That request was not understood' }],
    ['a not_member error', { type: 'error', code: 'not_member', message: "You're not in this room" }],
  ])('stops for good after %s', (_label, message) => {
    connected();
    const before = sockets.length;
    latest().serverSends(message);
    expect(service.status()).toBe('ended');
    expect(latest().closedByApp).toBe(true);
    latest().serverCloses();
    jest.advanceTimersByTime(60_000);
    expect(sockets.length).toBe(before);
  });

  it('keeps going after an error that answers a request', () => {
    connected();
    void service.request({ type: 'lobby.addBot' }).catch(() => undefined);
    latest().serverSends({ type: 'error', reqId: 'r1', code: 'not_member', message: "You're not in this room" });
    expect(service.status()).toBe('open');
  });

  it('end() closes the socket and never reconnects', () => {
    connected();
    const socket = latest();
    service.end();
    expect(socket.closedByApp).toBe(true);
    expect(service.status()).toBe('idle');
    jest.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  describe('when the page comes back', () => {
    const becomes = (state: 'visible' | 'hidden') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    afterEach(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }));

    // Three drops in a row: the next retry waits 4 s.
    function waitingFourSeconds(): void {
      connected();
      latest().serverCloses();
      jest.advanceTimersByTime(1_000);
      latest().serverCloses();
      jest.advanceTimersByTime(2_000);
      latest().serverCloses();
    }

    it('retries at once instead of waiting, and only once', () => {
      waitingFourSeconds();
      const before = sockets.length;
      becomes('hidden');
      expect(sockets.length).toBe(before);
      becomes('visible');
      expect(sockets.length).toBe(before + 1);
      jest.advanceTimersByTime(15_000);
      expect(sockets.length).toBe(before + 1);
    });

    it('starts the waits again from 1 s', () => {
      waitingFourSeconds();
      becomes('visible');
      const before = sockets.length;
      latest().serverCloses();
      jest.advanceTimersByTime(999);
      expect(sockets.length).toBe(before);
      jest.advanceTimersByTime(1);
      expect(sockets.length).toBe(before + 1);
    });

    it('leaves an open, connecting or idle socket alone', () => {
      becomes('visible');
      expect(sockets).toHaveLength(0);
      service.connect(ROOM.id);
      becomes('visible');
      expect(sockets).toHaveLength(1);
      latest().serverOpens();
      latest().serverSends(welcome());
      becomes('visible');
      expect(sockets).toHaveLength(1);
    });

    it('does nothing once ended, or after end()', () => {
      connected();
      latest().serverSends({ type: 'replaced' });
      latest().serverCloses();
      becomes('visible');
      expect(sockets).toHaveLength(1);
      service.connect(ROOM.id);
      service.end();
      becomes('visible');
      expect(sockets).toHaveLength(2);
    });

    it('stops listening when it is destroyed', () => {
      waitingFourSeconds();
      const before = sockets.length;
      TestBed.resetTestingModule();
      becomes('visible');
      expect(sockets.length).toBe(before);
    });
  });
});
