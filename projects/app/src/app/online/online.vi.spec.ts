import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import type { GameSummary, Me, RoomList, RoomListItem } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { I18n } from '../i18n/i18n.service';
import { msg, type Msg } from '../i18n/msg';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';
import { CreateRoomDialog } from './create-room-dialog';
import { gameHeadline, gameOutcome, gameWhen, playerLabel } from './game-labels';
import { JoinRoomDialog } from './join-room-dialog';
import { MyGamesPage } from './my-games-page';
import { MyGamesService } from './my-games.service';
import { OnlineNotice } from './online-notice';
import { OnlineResult } from './online-result';
import { PlayVsBotsDialog } from './play-vs-bots-dialog';
import { canJoin, roomStatusLabel, roomTitle } from './room-labels';
import { RoomsPage } from './rooms-page';
import { RoomsService } from './rooms.service';
import { LAST_GAME, chatMessage } from './testing';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const buttons = (el: HTMLElement) => [...el.querySelectorAll('mat-dialog-actions button')].map(text);
const ANN: Me = { id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' };
const LIST: RoomList = {
  rooms: [
    { id: 'r-mine', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true },
    { id: 'r-open', visibility: 'open', hostName: 'Bo', memberCount: 2, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-full', visibility: 'open', hostName: 'Cy', memberCount: 4, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-playing', visibility: 'open', hostName: 'Di', memberCount: 3, capacity: 3, status: 'playing', youAreMember: false },
    { id: 'r-solo', visibility: 'solo', hostName: null, memberCount: 1, capacity: 4, status: 'playing', youAreMember: true },
  ],
  seatLimits: { min: 2, max: 8 },
};
const GAME: GameSummary = {
  gameId: 'g1',
  finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
  players: [
    { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', name: 'Ann', kind: 'human' },
  ],
  result: { endedAt: 40, winningKingdom: 'Wei', winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] },
  yourSeat: 'seat-1',
};

describe('Rooms, My Games and the dialogs in Vietnamese', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  const vietnamese = () => TestBed.inject(I18n).setLocale('vi');

  describe('RoomsPage', () => {
    const list = signal<RoomList | null>(LIST);
    const error = signal<Msg | null>(null);
    const me = signal<Me | null>(ANN);
    const rooms = { list, error, startPolling: jest.fn(), stopPolling: jest.fn() };
    const auth = { me, isRegistered: computed(() => me()?.kind === 'registered') };

    async function render(notice = new OnlineNotice()) {
      TestBed.configureTestingModule({
        imports: [RoomsPage],
        providers: [
          { provide: RoomsService, useValue: rooms },
          { provide: AuthService, useValue: auth },
          { provide: MatDialog, useValue: { open: jest.fn() } },
          { provide: OnlineNotice, useValue: notice },
          provideRouter([]),
        ],
      });
      await vietnamese();
      const fixture = TestBed.createComponent(RoomsPage);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    beforeEach(() => {
      list.set(LIST);
      error.set(null);
      me.set(ANN);
    });

    it('the title, toolbar, rows and their buttons', async () => {
      const { el } = await render();
      expect(text(el.querySelector('mat-card-title'))).toBe('Phòng');
      expect(text(el.querySelector('button.create'))).toContain('Tạo phòng');
      expect(text(el.querySelector('button.play-vs-bots'))).toContain('Chơi với máy');
      expect(text(el.querySelector('a.my-games'))).toContain('Ván của tôi');
      const rows = [...el.querySelectorAll('li.room')];
      expect(rows.map((r) => text(r.querySelector('.host-name')))).toEqual(['Ann', 'Bo', 'Cy', 'Di', 'Chơi với máy']);
      expect(rows.map((r) => text(r.querySelector('.status')))).toEqual(['Chờ người chơi', 'Chờ người chơi', 'Đầy', 'Đang chơi', 'Đang chơi']);
      expect(text(rows[0].querySelector('.rejoin'))).toBe('Vào lại');
      expect(text(rows[1].querySelector('.join'))).toBe('Tham gia');
    });

    it('the hint for a guest, the empty list, the loading line and an error', async () => {
      me.set({ id: 'u2', kind: 'guest', displayName: 'Gus' });
      const { fixture, el } = await render();
      expect(text(el.querySelector('.host-hint'))).toBe('Đăng nhập để tạo phòng');
      list.set({ ...LIST, rooms: [] });
      fixture.detectChanges();
      expect(text(el.querySelector('.empty'))).toBe('Chưa có phòng nào');
      list.set(null);
      fixture.detectChanges();
      expect(text(el.querySelector('.loading'))).toBe('Đang tải danh sách phòng…');
      error.set(msg('error.network'));
      fixture.detectChanges();
      expect(text(el.querySelector('.error'))).toBe('Không kết nối được với máy chủ. Hãy kiểm tra kết nối rồi thử lại');
    });

    it('the notice the Lobby left, and a language switch on the open page', async () => {
      const notice = new OnlineNotice();
      notice.show(msg('roomLeft.host_left'));
      const { fixture, el } = await render(notice);
      expect(text(el.querySelector('.notice'))).toBe('Chủ phòng đã đóng phòng');
      await TestBed.inject(I18n).setLocale('en');
      fixture.detectChanges();
      expect(text(el.querySelector('.notice'))).toBe('The host closed the room');
      expect(text(el.querySelector('mat-card-title'))).toBe('Rooms');
    });
  });

  describe('room and game labels', () => {
    const tr = makeTranslator(vi, 'vi');
    const room = (patch: Partial<RoomListItem>): RoomListItem => ({ ...LIST.rooms[1], ...patch });

    it('the status, the title and the join rule', () => {
      expect(roomStatusLabel(room({ status: 'playing' }), tr)).toBe('Đang chơi');
      expect(roomStatusLabel(room({ memberCount: 4 }), tr)).toBe('Đầy');
      expect(roomStatusLabel(room({}), tr)).toBe('Chờ người chơi');
      expect(roomTitle(room({ visibility: 'solo' }), tr)).toBe('Chơi với máy');
      expect(roomTitle(room({ hostName: null }), tr)).toBe('Phòng');
      expect(roomTitle(room({}), tr)).toBe('Bo');
      expect(canJoin(room({}))).toBe(true);
    });

    it('the outcome, the headline, the players and the date', () => {
      expect(gameOutcome(GAME, tr)).toBe('Thắng');
      expect(gameOutcome({ ...GAME, yourSeat: 'seat-0' }, tr)).toBe('Thua');
      expect(gameOutcome({ ...GAME, result: null }, tr)).toBe('Hòa');
      expect(gameHeadline(GAME, tr)).toBe('Ngụy thắng');
      expect(gameHeadline({ ...GAME, result: { ...GAME.result!, winningKingdom: undefined } }, tr)).toBe('Ann thắng');
      expect(gameHeadline({ ...GAME, result: { ...GAME.result!, winningKingdom: undefined, winningSeatIds: [] } }, tr)).toBe('Không ai sống sót');
      expect(playerLabel(GAME, 'seat-1', tr)).toBe('Ann (bạn)');
      expect(playerLabel(GAME, 'seat-0', tr)).toBe('Bot 1 (máy)');
      expect(gameWhen(GAME, tr)).toMatch(/2026/);
      expect(gameWhen(GAME, tr)).toContain('thg');
      expect(gameWhen(GAME, tr)).not.toBe(gameWhen(GAME, makeTranslator(vi, 'en')));
    });
  });

  describe('MyGamesPage', () => {
    const games = signal<GameSummary[] | null>(null);
    const error = signal<Msg | null>(null);
    const service = { games, error, load: jest.fn(async () => undefined) };

    async function render() {
      await TestBed.configureTestingModule({ imports: [MyGamesPage], providers: [provideRouter([])] })
        .overrideComponent(MyGamesPage, { set: { providers: [{ provide: MyGamesService, useValue: service }] } })
        .compileComponents();
      await vietnamese();
      const fixture = TestBed.createComponent(MyGamesPage);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('the title, the loading line, the empty list, a row and an error', async () => {
      games.set(null);
      error.set(null);
      const { fixture, el } = await render();
      expect(text(el.querySelector('mat-card-title'))).toBe('Ván của tôi');
      expect(text(el.querySelector('.loading'))).toBe('Đang tải các ván…');
      games.set([]);
      fixture.detectChanges();
      expect(text(el.querySelector('.empty'))).toBe('Chưa có ván nào kết thúc');
      games.set([GAME]);
      fixture.detectChanges();
      expect(text(el.querySelector('.outcome'))).toBe('Thắng');
      expect(text(el.querySelector('.headline'))).toBe('Ngụy thắng');
      expect(text(el.querySelector('.players'))).toBe('Bot 1 (máy), Ann (bạn)');
      expect(text(el.querySelector('a.back'))).toBe('Quay lại danh sách phòng');
      error.set(msg('error.registered_only'));
      fixture.detectChanges();
      expect(text(el.querySelector('.error'))).toBe('Hãy đăng nhập bằng tài khoản để xem các ván của bạn');
    });
  });

  describe('dialogs', () => {
    async function open<T>(component: new () => T, data: unknown) {
      TestBed.configureTestingModule({
        imports: [component as never],
        providers: [
          { provide: RoomsService, useValue: { create: jest.fn(), join: jest.fn(), createSolo: jest.fn() } },
          { provide: MatDialogRef, useValue: { close: jest.fn() } },
          { provide: MAT_DIALOG_DATA, useValue: data },
        ],
      });
      await vietnamese();
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('Create Room', async () => {
      const { fixture, el } = await open(CreateRoomDialog, { seatLimits: { min: 2, max: 8 }, displayName: 'Ann' });
      (fixture.componentInstance as CreateRoomDialog).seatCount.set(5);
      fixture.detectChanges();
      expect(text(el.querySelector('[mat-dialog-title]'))).toBe('Tạo phòng');
      expect(text(el.querySelector('mat-label'))).toBe('Tên của bạn');
      expect(text(el.querySelector('.field .label'))).toBe('Số người chơi');
      expect(text(el.querySelector('.first-reveal'))).toBe('Thưởng lật đầu tiên');
      expect(buttons(el)).toEqual(['Hủy', 'Tạo phòng']);
    });

    it('Join Room', async () => {
      const { el } = await open(JoinRoomDialog, { roomId: 'r1', hostName: 'Bo', displayName: 'Ann' });
      expect(text(el.querySelector('[mat-dialog-title]'))).toBe('Tham gia phòng');
      expect(text(el.querySelector('.hosted-by'))).toBe('Chủ phòng: Bo');
      expect(buttons(el)).toEqual(['Hủy', 'Tham gia']);
    });

    it('Play vs Bots, with a game already running', async () => {
      const { el } = await open(PlayVsBotsDialog, { seatLimits: { min: 2, max: 8 }, existingRoomId: 'r-solo' });
      expect(text(el.querySelector('[mat-dialog-title]'))).toBe('Chơi với máy');
      expect(text(el.querySelector('.in-progress'))).toBe('Bạn đang có một ván chơi với máy');
      expect(buttons(el)).toEqual(['Hủy', 'Bỏ ván và bắt đầu ván mới', 'Tiếp tục ván']);
    });
  });

  describe('OnlineResult and the chat panel', () => {
    it('a finished game, a stopped one and a solo game', async () => {
      TestBed.configureTestingModule({ imports: [OnlineResult] });
      await vietnamese();
      const render = (ending: typeof LAST_GAME, solo = false) => {
        const fixture = TestBed.createComponent(OnlineResult);
        fixture.componentRef.setInput('ending', ending);
        fixture.componentRef.setInput('solo', solo);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
      };
      let el = render(LAST_GAME);
      expect(el.querySelector('mat-card-title')).toBeNull();
      expect(text(el.querySelector('app-victory-board .eyebrow'))).toBe('Hết ván');
      expect(text(el.querySelector('app-victory-board .headline'))).toBe('Ngụy thắng!');
      expect(el.querySelector('.winners')).toBeNull();
      expect(text(el.querySelector('button.back-to-lobby'))).toBe('Quay lại sảnh chờ');
      el = render({ ...LAST_GAME, outcome: 'broken', result: null });
      expect(text(el.querySelector('mat-card-title'))).toBe('Ván đã dừng');
      expect(text(el.querySelector('.stopped'))).toBe('Ván chơi này gặp lỗi và đã dừng');
      el = render(LAST_GAME, true);
      expect(text(el.querySelector('button.back-to-rooms'))).toBe('Quay lại danh sách phòng');
      expect(text(el.querySelector('button.play-again'))).toContain('Chơi lại');
    });

    it('the chat panel: empty, a refusal and the composer', async () => {
      const messages = signal([chatMessage(1, 'Bo', 'hi')]);
      const error = signal<Msg | null>(null);
      TestBed.configureTestingModule({ imports: [ChatPanel], providers: [{ provide: ChatService, useValue: { messages, error, send: jest.fn(async () => true) } }] });
      await vietnamese();
      const fixture = TestBed.createComponent(ChatPanel);
      fixture.componentRef.setInput('you', 'p-ann');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.messages')!.getAttribute('aria-label')).toBe('Tin nhắn trò chuyện');
      expect((el.querySelector('input.draft') as HTMLInputElement).placeholder).toBe('Nói gì đó…');
      expect(el.querySelector('button.send')!.getAttribute('aria-label')).toBe('Gửi');
      messages.set([]);
      error.set(msg('error.chat_too_long', { max: 300 }));
      fixture.detectChanges();
      expect(text(el.querySelector('.empty'))).toBe('Chưa có tin nhắn');
      expect(text(el.querySelector('.error'))).toBe('Tin nhắn tối đa 300 ký tự');
    });
  });
});
