import { TestBed } from '@angular/core/testing';
import { ERROR_MESSAGES } from 'protocol';
import { ChatService } from './chat.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { chatMessage, FakeSocket, ROOM, welcome } from './testing';
import { english } from '../i18n/msg.testing';

describe('ChatService', () => {
  let socket: FakeSocket;
  let chat: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService, ChatService, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    chat = TestBed.inject(ChatService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
  });

  const bodies = () => chat.messages().map((m) => m.body);

  it('starts empty and takes the history from the welcome', () => {
    expect(chat.messages()).toEqual([]);
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one'), chatMessage(2, 'Bo', 'two')]));
    expect(bodies()).toEqual(['one', 'two']);
  });

  it('appends each message that arrives, in order', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends({ type: 'chat.message', ...chatMessage(2, 'Bo', 'two') });
    socket.serverSends({ type: 'chat.message', ...chatMessage(3, 'Ann', 'three') });
    expect(bodies()).toEqual(['one', 'two', 'three']);
  });

  it('shows a message that arrives twice once (Review Focus 5)', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends({ type: 'chat.message', ...chatMessage(1, 'Ann', 'one') });
    expect(bodies()).toEqual(['one']);
  });

  it('replaces everything with the history of the next welcome, as after a reconnect (Review Focus 5)', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one'), chatMessage(2, 'Bo', 'sent while you were away')]));
    expect(bodies()).toEqual(['one', 'sent while you were away']);
  });

  it('keeps only the newest 300 messages', () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    for (let i = 1; i <= 305; i += 1) socket.serverSends({ type: 'chat.message', ...chatMessage(i, 'Ann', `m${i}`) });
    expect(chat.messages()).toHaveLength(300);
    expect(bodies()[0]).toBe('m6');
  });

  it('sends chat.send and resolves true when the server acks', async () => {
    socket.serverSends(welcome());
    const sent = chat.send('hello');
    expect(socket.lastSent).toMatchObject({ type: 'chat.send', body: 'hello' });
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await expect(sent).resolves.toBe(true);
    expect(chat.error()).toBeNull();
  });

  it("resolves false with the server's message when it refuses, and clears the message on the next send", async () => {
    socket.serverSends(welcome());
    const refused = chat.send('too fast');
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'chat_rate_limited', message: ERROR_MESSAGES.chat_rate_limited });
    await expect(refused).resolves.toBe(false);
    expect(english(chat.error())).toBe('You are sending messages too fast. Wait a moment');
    const next = chat.send('later');
    expect(chat.error()).toBeNull();
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await expect(next).resolves.toBe(true);
  });

  it("resolves false when the socket isn't open", async () => {
    await expect(chat.send('hello')).resolves.toBe(false);
    expect(english(chat.error())).toBe("Can't reach the server. Check your connection and try again");
  });
});
