import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ChatMessage, LastGame, RoomSnapshot } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { msg, type Msg } from '../i18n/msg';
import { BoardChat } from './board-chat';
import { ChatService } from './chat.service';
import { LobbyPage } from './lobby-page';
import { LobbyService } from './lobby.service';
import { OnlineGame } from './online-game';
import { RemoteGameService } from './remote-game.service';
import { SocketStatus } from './socket.service';
import { ROOM } from './testing';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

const MIXED: RoomSnapshot = {
  ...ROOM,
  seatCount: 5,
  members: [
    { playerId: 'p-ann', name: 'Ann', kind: 'human', seatId: null, isRegistered: true, connected: true, botControlled: false },
    { playerId: 'p-bo', name: 'Bo', kind: 'human', seatId: null, isRegistered: true, connected: false, botControlled: false },
    { playerId: 'p-gus', name: 'Gus', kind: 'human', seatId: null, isRegistered: false, connected: true, botControlled: false },
    { playerId: 'p-bot', name: 'Bot 1', kind: 'bot', seatId: null, isRegistered: false, connected: true, botControlled: false },
  ],
};

function fakeLobby(you = 'p-ann') {
  const room = signal<RoomSnapshot | null>(MIXED);
  const youId = signal<string | null>(you);
  const status = signal<SocketStatus>('open');
  const ended = signal<Msg | null>(null);
  return {
    room,
    you: youId,
    status,
    ended,
    isSolo: signal(false),
    notice: signal<Msg | null>(null),
    error: signal<Msg | null>(null),
    waitingForHost: signal<Msg | null>(null),
    isHost: computed(() => room()?.hostPlayerId === youId()),
    canAct: computed(() => status() === 'open' && ended() === null),
    canStart: computed(() => room()?.status === 'lobby' && room()?.hostPlayerId === youId()),
    start: jest.fn(async () => true),
    open: jest.fn(),
    addBot: jest.fn(async () => true),
    removePlayer: jest.fn(async () => true),
    makeHost: jest.fn(async () => true),
    setRules: jest.fn(async () => true),
    leave: jest.fn(async () => undefined),
  };
}

describe('LobbyPage in Vietnamese', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function render(lobby: ReturnType<typeof fakeLobby>) {
    const game = { ending: signal<LastGame | null>(null), playing: signal(false), dismiss: jest.fn() };
    const chat = { messages: signal<ChatMessage[]>([]), error: signal<Msg | null>(null), send: jest.fn(async () => true) };
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'rooms/:id', component: LobbyPage }, { path: 'rooms', children: [] }])] });
    TestBed.overrideComponent(OnlineGame, { set: { imports: [], providers: [], template: '' } });
    TestBed.overrideComponent(LobbyPage, { set: { providers: [{ provide: LobbyService, useValue: lobby }, { provide: RemoteGameService, useValue: game }, { provide: ChatService, useValue: chat }] } });
    await TestBed.inject(I18n).setLocale('vi');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rooms/${ROOM.id}`, LobbyPage);
    const el = harness.routeNativeElement as HTMLElement;
    const member = (name: string) => [...el.querySelectorAll('li.member')].find((li) => li.querySelector('.name')?.textContent?.trim() === name) as HTMLElement;
    const badges = (name: string) => [...member(name).querySelectorAll('.badge')].map(text);
    return { harness, el, member, badges };
  }

  it('the host sees the title, count, headings, badges and controls in Vietnamese', async () => {
    const { el, member, badges } = await render(fakeLobby());
    expect(text(el.querySelector('mat-card-title'))).toBe('Sảnh chờ');
    expect(text(el.querySelector('.player-count'))).toBe('4 / 5 người chơi');
    expect([...el.querySelectorAll('h3')].map(text)).toEqual(['Luật', 'Người chơi', 'Trò chuyện']);
    expect(text(el.querySelector('#lobby-seats'))).toBe('Số người chơi');
    expect(text(el.querySelector('.first-reveal'))).toBe('Thưởng lật đầu tiên');
    expect(badges('Ann')).toEqual(['Chủ phòng', 'Bạn']);
    expect(badges('Bo')).toEqual(['Vắng mặt']);
    expect(badges('Gus')).toEqual(['Khách']);
    expect(badges('Bot 1')).toEqual(['Máy']);
    expect(text(member('Bo').querySelector('.make-host'))).toBe('Chọn làm chủ phòng');
    expect(text(member('Bo').querySelector('.remove'))).toBe('Loại bỏ');
    expect(text(el.querySelector('.start-hint'))).toBe('Cần đủ người chơi để bắt đầu');
    expect(text(el.querySelector('button.start'))).toContain('Bắt đầu ván chơi');
    expect(text(el.querySelector('button.add-bot'))).toContain('Thêm máy');
    expect(text(el.querySelector('button.leave'))).toBe('Rời phòng');
  });

  it('a guest sees the rules summary', async () => {
    const lobby = fakeLobby('p-gus');
    const { harness, el } = await render(lobby);
    expect(text(el.querySelector('.rules-summary'))).toBe('5 người chơi · Bộ bài: Quốc chiến · Thưởng lật đầu tiên: Bật');
    lobby.room.set({ ...MIXED, rules: { firstRevealDraw: false } });
    harness.detectChanges();
    expect(text(el.querySelector('.rules-summary'))).toBe('5 người chơi · Bộ bài: Quốc chiến · Thưởng lật đầu tiên: Tắt');
    lobby.room.set({ ...MIXED, seatCount: 4 });
    harness.detectChanges();
    expect(text(el.querySelector('.rules-summary'))).toBe('4 người chơi · Bộ bài: Quốc chiến');
  });

  it('the banners, the notice and the error read in Vietnamese and follow a language switch', async () => {
    const lobby = fakeLobby();
    const { harness, el } = await render(lobby);
    lobby.status.set('reconnecting');
    lobby.waitingForHost.set(msg('lobby.waitingForHost', { name: 'Ann' }));
    lobby.notice.set(msg('lobby.nowHost', { name: 'Bo' }));
    lobby.error.set(msg('error.not_host'));
    harness.detectChanges();
    expect(text(el.querySelector('.reconnecting'))).toBe('Đang kết nối lại…');
    expect(text(el.querySelector('.waiting'))).toBe('Đang chờ Ann quay lại…');
    expect(text(el.querySelector('.notice'))).toBe('Bo đã trở thành chủ phòng');
    expect(text(el.querySelector('.error'))).toBe('Chỉ chủ phòng mới làm được việc đó');
    await TestBed.inject(I18n).setLocale('en');
    harness.detectChanges();
    expect(text(el.querySelector('.reconnecting'))).toBe('Reconnecting…');
    expect(text(el.querySelector('.notice'))).toBe('Bo is now the host');
    expect(text(el.querySelector('.error'))).toBe('Only the host can do that');
  });

  it('a connection that ended offers Back to Rooms, and a room still loading says Connecting', async () => {
    const lobby = fakeLobby();
    const { harness, el } = await render(lobby);
    lobby.ended.set(msg('room.replaced'));
    harness.detectChanges();
    expect(text(el.querySelector('.ended'))).toBe('Phòng này đang mở ở một thẻ khác');
    expect(text(el.querySelector('a.back'))).toBe('Quay lại danh sách phòng');
    lobby.ended.set(null);
    lobby.room.set(null);
    harness.detectChanges();
    expect(text(el.querySelector('.loading'))).toBe('Đang kết nối…');
  });

  it('the room is waiting for its game', async () => {
    const lobby = fakeLobby();
    lobby.room.set({ ...MIXED, status: 'playing' });
    const { el } = await render(lobby);
    expect(text(el.querySelector('.waiting-for-game'))).toBe('Đang chờ ván chơi…');
  });
});

describe('BoardChat in Vietnamese', () => {
  it('the Chat button, its unread label and the drawer', async () => {
    localStorage.clear();
    const messages = signal<ChatMessage[]>([]);
    TestBed.configureTestingModule({ imports: [BoardChat], providers: [{ provide: ChatService, useValue: { messages, error: signal<Msg | null>(null), send: jest.fn() } }] });
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(BoardChat);
    fixture.componentRef.setInput('you', 'p-ann');
    fixture.detectChanges();
    messages.set([{ id: 1, from: { playerId: 'p-bo', name: 'Bo' }, body: 'hi', at: 0 }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('button.chat-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).toBe('Trò chuyện, 1 chưa đọc');
    expect(text(toggle)).toContain('Trò chuyện');
    toggle.click();
    fixture.detectChanges();
    expect(el.querySelector('aside')!.getAttribute('aria-label')).toBe('Trò chuyện');
    expect(el.querySelector('button.close-chat')!.getAttribute('aria-label')).toBe('Đóng trò chuyện');
    localStorage.clear();
  });
});
