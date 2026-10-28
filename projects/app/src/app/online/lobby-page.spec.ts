import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatButtonToggle } from '@angular/material/button-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ChatMessage, LastGame, RoomSnapshot } from 'protocol';
import { ChatService } from './chat.service';
import { LobbyPage } from './lobby-page';
import { LobbyService } from './lobby.service';
import { OnlineGame } from './online-game';
import { RemoteGameService } from './remote-game.service';
import { SocketStatus } from './socket.service';
import { LAST_GAME, ROOM } from './testing';
import { msg, type Msg } from '../i18n/msg';

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

function fakeLobby() {
  const room = signal<RoomSnapshot | null>(MIXED);
  const you = signal<string | null>('p-ann');
  const status = signal<SocketStatus>('open');
  const ended = signal<Msg | null>(null);
  const isSolo = signal(false);
  return {
    room,
    you,
    status,
    ended,
    isSolo,
    notice: signal<Msg | null>(null),
    error: signal<Msg | null>(null),
    waitingForHost: signal<Msg | null>(null),
    isHost: computed(() => room()?.hostPlayerId === you()),
    canAct: computed(() => status() === 'open' && ended() === null),
    canStart: computed(() => room()?.status === 'lobby' && (room()?.hostPlayerId === you() || isSolo())),
    start: jest.fn(async () => true),
    open: jest.fn(),
    addBot: jest.fn(async () => true),
    removePlayer: jest.fn(async () => true),
    makeHost: jest.fn(async () => true),
    setRules: jest.fn(async () => true),
    leave: jest.fn(async () => undefined),
  };
}

function fakeGame() {
  return { ending: signal<LastGame | null>(null), playing: signal(false), dismiss: jest.fn() };
}

function fakeChat() {
  return { messages: signal<ChatMessage[]>([]), error: signal<string | null>(null), send: jest.fn(async () => true) };
}

describe('LobbyPage', () => {
  let lobby: ReturnType<typeof fakeLobby>;
  let game: ReturnType<typeof fakeGame>;

  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'rooms/:id', component: LobbyPage }, { path: 'rooms', children: [] }])] });
    TestBed.overrideComponent(OnlineGame, { set: { imports: [], providers: [], template: '' } });
    TestBed.overrideComponent(LobbyPage, { set: { providers: [{ provide: LobbyService, useValue: lobby }, { provide: RemoteGameService, useValue: game }, { provide: ChatService, useValue: fakeChat() }] } });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rooms/${ROOM.id}`, LobbyPage);
    const el = harness.routeNativeElement as HTMLElement;
    const member = (name: string) => [...el.querySelectorAll('li.member')].find((li) => li.querySelector('.name')?.textContent?.trim() === name) as HTMLElement;
    const badges = (name: string) => [...member(name).querySelectorAll('.badge')].map((b) => b.textContent?.trim());
    return { harness, el, member, badges };
  }

  beforeEach(() => {
    lobby = fakeLobby();
    game = fakeGame();
  });

  it('connects to the room in the URL', async () => {
    await render();
    expect(lobby.open).toHaveBeenCalledWith(ROOM.id);
  });

  it('shows the players with Host, You, Guest, Bot and Away badges, and the count', async () => {
    const { el, badges } = await render();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Lobby');
    expect(el.querySelector('.player-count')?.textContent?.trim()).toBe('4 / 5 Players');
    expect(badges('Ann')).toEqual(['Host', 'You']);
    expect(badges('Bo')).toEqual(['Away']);
    expect(badges('Gus')).toEqual(['Guest']);
    expect(badges('Bot 1')).toEqual(['Bot']);
  });

  it('gives the host Add Bot, Remove for others, and Make Host for registered players only', async () => {
    const { el, member } = await render();
    expect(el.querySelector('button.add-bot')?.textContent).toContain('Add Bot');
    expect(member('Ann').querySelector('button.remove')).toBeNull();
    expect(member('Bo').querySelector('button.make-host')?.textContent).toContain('Make Host');
    expect(member('Gus').querySelector('button.make-host')).toBeNull();
    expect(member('Bot 1').querySelector('button.make-host')).toBeNull();
    expect(member('Bot 1').querySelector('button.remove')?.textContent).toContain('Remove');
  });

  it('sends what the host clicks', async () => {
    const { el, member, harness } = await render();
    (el.querySelector('button.add-bot') as HTMLButtonElement).click();
    (member('Bo').querySelector('button.make-host') as HTMLButtonElement).click();
    (member('Gus').querySelector('button.remove') as HTMLButtonElement).click();
    const six = [...el.querySelectorAll('.seats mat-button-toggle')].find((t) => t.textContent?.trim() === '6')!;
    (six.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('button.leave') as HTMLButtonElement).click();
    expect(lobby.addBot).toHaveBeenCalled();
    expect(lobby.makeHost).toHaveBeenCalledWith('p-bo');
    expect(lobby.removePlayer).toHaveBeenCalledWith('p-gus');
    expect(lobby.setRules).toHaveBeenCalledWith(6, { firstRevealDraw: true });
    expect(lobby.leave).toHaveBeenCalled();
  });

  it('puts the seat toggle back when the server refuses the change', async () => {
    lobby.setRules.mockResolvedValue(false);
    lobby.room.set({ ...MIXED, rules: { deck: 'dynastyWars' } });
    const { el, harness } = await render();
    const checked = () => harness.routeDebugElement!.queryAll(By.directive(MatButtonToggle)).filter((t) => (t.componentInstance as MatButtonToggle).checked).map((t) => (t.componentInstance as MatButtonToggle).value);
    harness.detectChanges();
    expect(checked()).toEqual([5]);
    const six = [...el.querySelectorAll('.seats mat-button-toggle')].find((t) => t.textContent?.trim() === '6')!;
    (six.querySelector('button') as HTMLButtonElement).click();
    expect(checked()).toEqual([6]);
    await harness.fixture.whenStable();
    expect(checked()).toEqual([5]);
  });

  it('puts the First Reveal checkbox back when the server refuses the change', async () => {
    lobby.setRules.mockResolvedValue(false);
    const { el, harness } = await render();
    const box = harness.routeDebugElement!.query(By.directive(MatCheckbox)).componentInstance as MatCheckbox;
    (el.querySelector('.first-reveal input') as HTMLInputElement).click();
    expect(box.checked).toBe(false);
    await harness.fixture.whenStable();
    expect(box.checked).toBe(true);
  });

  it('gives the host a deck choice that sends the new deck beside the other rules', async () => {
    lobby.room.set({ ...MIXED, rules: { firstRevealDraw: true, deck: 'dynastyWars' } });
    const { el, harness } = await render();
    expect([...el.querySelectorAll('.deck mat-radio-button')].map((r) => (r.querySelector('input') as HTMLInputElement).checked)).toEqual([false, true]);
    const kingdomWars = [...el.querySelectorAll('.deck mat-radio-button')].find((r) => r.textContent?.trim() === 'Kingdom Wars')!;
    (kingdomWars.querySelector('input') as HTMLInputElement).click();
    harness.detectChanges();
    expect(lobby.setRules).toHaveBeenCalledWith(5, { firstRevealDraw: true, deck: 'kingdomWars' });
  });

  it('puts the deck choice back when the server refuses the change', async () => {
    lobby.setRules.mockResolvedValue(false);
    lobby.room.set({ ...MIXED, rules: { deck: 'dynastyWars' } });
    lobby.room.set({ ...MIXED, rules: { deck: 'dynastyWars' } });
    const { el, harness } = await render();
    const checked = () => [...el.querySelectorAll('.deck mat-radio-button input')].map((i) => (i as HTMLInputElement).checked);
    const kingdomWars = [...el.querySelectorAll('.deck mat-radio-button')].find((r) => r.textContent?.trim() === 'Kingdom Wars')!;
    (kingdomWars.querySelector('input') as HTMLInputElement).click();
    harness.detectChanges();
    expect(checked()).toEqual([true, false]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(checked()).toEqual([false, true]);
  });

  it('shows a non-host which deck the room uses', async () => {
    lobby.you.set('p-bo');
    lobby.room.set({ ...MIXED, rules: { deck: 'dynastyWars' } });
    const { el } = await render();
    expect(el.querySelector('.rules-summary')?.textContent?.trim()).toBe('5 Seats · Deck: Dynasty Wars · First Reveal Bonus: Off');
  });

  it('disables the deck choice while the socket is down', async () => {
    lobby.status.set('reconnecting');
    const { el } = await render();
    expect([...el.querySelectorAll('.deck mat-radio-button input')].map((i) => (i as HTMLInputElement).disabled)).toEqual([true, true]);
  });

  it('offers seat counts from the member count up to the limit', async () => {
    const { el } = await render();
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['4', '5', '6', '7', '8']);
    expect(el.querySelector('.first-reveal')?.textContent).toContain('First Reveal Bonus');
  });

  it('disables Add Bot when every seat is taken', async () => {
    lobby.room.set({ ...MIXED, seatCount: 4 });
    const { el } = await render();
    expect((el.querySelector('button.add-bot') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a non-host the rules, with no host controls', async () => {
    lobby.you.set('p-bo');
    const { el } = await render();
    expect(el.querySelector('.rules-summary')?.textContent?.trim()).toBe('5 Seats · Deck: Kingdom Wars · First Reveal Bonus: On');
    expect(el.querySelector('.deck')).toBeNull();
    expect(el.querySelector('button.add-bot')).toBeNull();
    expect(el.querySelector('button.remove')).toBeNull();
    expect(el.querySelector('.seats')).toBeNull();
    expect(el.querySelector('button.leave')?.textContent).toContain('Leave Room');
  });

  it('shows Reconnecting… and disables actions while the socket is down', async () => {
    lobby.status.set('reconnecting');
    const { el } = await render();
    expect(el.querySelector('.banner.reconnecting')?.textContent?.trim()).toBe('Reconnecting…');
    expect((el.querySelector('button.add-bot') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('button.leave') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows that the room is waiting for its host', async () => {
    lobby.waitingForHost.set(msg('lobby.waitingForHost', { name: 'Ann' }));
    const { el } = await render();
    expect(el.querySelector('.banner.waiting')?.textContent?.trim()).toBe('Waiting for Ann to return…');
  });

  it('shows why the connection ended, and offers Back to Rooms', async () => {
    lobby.ended.set(msg('room.replaced'));
    const { el } = await render();
    expect(el.querySelector('.banner.ended')?.textContent?.trim()).toBe('This room is open in another tab');
    expect(el.querySelector('a.back')?.getAttribute('href')).toBe('/rooms');
    expect(el.querySelector('button.leave')).toBeNull();
  });

  it('shows the host-change notice and request errors', async () => {
    lobby.notice.set(msg('lobby.nowHost', { name: 'Bo' }));
    lobby.error.set(msg('error.not_host'));
    const { el } = await render();
    expect(el.querySelector('.notice')?.textContent?.trim()).toBe('Bo is now the host');
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('Only the host can do that');
  });
  it('gives the host Start Game, held back with a hint until every seat is filled', async () => {
    const { el, harness } = await render();
    const start = () => el.querySelector('button.start') as HTMLButtonElement;
    expect(start().textContent).toContain('Start Game');
    expect(start().disabled).toBe(true);
    expect(el.querySelector('.start-hint')?.textContent?.trim()).toBe('Fill every seat to start');
    lobby.room.set({ ...MIXED, seatCount: 4 });
    harness.detectChanges();
    expect(start().disabled).toBe(false);
    expect(el.querySelector('.start-hint')).toBeNull();
    start().click();
    expect(lobby.start).toHaveBeenCalled();
  });

  it("shows Start Game to a solo room's player, and to no other member", async () => {
    lobby.you.set('p-bo');
    const { el, harness } = await render();
    expect(el.querySelector('button.start')).toBeNull();
    lobby.isSolo.set(true);
    harness.detectChanges();
    expect(el.querySelector('button.start')).not.toBeNull();
  });

  it('shows the board instead of the lobby while the game runs', async () => {
    game.playing.set(true);
    const { el } = await render();
    expect(el.querySelector('app-online-game')).not.toBeNull();
    expect(el.querySelector('.member-list')).toBeNull();
  });

  it('says it is waiting for the game, with no lobby controls, while the room plays without a game to show', async () => {
    lobby.room.set({ ...MIXED, status: 'playing' });
    const { el } = await render();
    expect(el.querySelector('.waiting-for-game')?.textContent?.trim()).toBe('Waiting for the game…');
    expect(el.querySelector('.rules')).toBeNull();
    expect(el.querySelector('.member-list')).toBeNull();
    expect(el.querySelector('button.add-bot')).toBeNull();
    expect(el.querySelector('button.start')).toBeNull();
    expect(el.querySelector('button.leave')?.textContent).toContain('Leave Room');
  });

  it('shows how the last game ended, and Back to Lobby returns to the lobby', async () => {
    game.ending.set(LAST_GAME);
    const { el } = await render();
    expect(el.querySelector('app-online-result mat-card-title')).toBeNull();
    expect(el.querySelector('app-online-result .eyebrow')?.textContent?.trim()).toBe('Game Over');
    expect(el.querySelector('app-online-result .headline')?.textContent?.trim()).toBe('Wei wins!');
    // Ann (p-ann) is the viewer.
    expect(el.querySelector('app-online-result .you')?.closest('.m')?.querySelector('.name')?.textContent?.trim()).toBe('Ann');
    expect(el.querySelector('.member-list')).toBeNull();
    (el.querySelector('button.back-to-lobby') as HTMLButtonElement).click();
    expect(game.dismiss).toHaveBeenCalled();
  });

  it('offers Play Again and Back to Rooms after a solo game', async () => {
    lobby.isSolo.set(true);
    game.ending.set(LAST_GAME);
    const { el } = await render();
    (el.querySelector('button.play-again') as HTMLButtonElement).click();
    expect(lobby.start).toHaveBeenCalled();
    (el.querySelector('button.back-to-rooms') as HTMLButtonElement).click();
    expect(lobby.leave).toHaveBeenCalled();
  });

  it('shows the chat in the lobby of an open room', async () => {
    const { el } = await render();
    expect(el.querySelector('section.chat h3')?.textContent?.trim()).toBe('Chat');
    expect(el.querySelector('section.chat app-chat-panel')).not.toBeNull();
  });

  it('has no chat in a solo room', async () => {
    lobby.isSolo.set(true);
    const { el } = await render();
    expect(el.querySelector('app-chat-panel')).toBeNull();
  });

  it("shows the board's chat button while a game runs, instead of the Lobby's chat", async () => {
    game.playing.set(true);
    const first = await render();
    expect(first.el.querySelector('app-board-chat button.chat-toggle')).not.toBeNull();
    expect(first.el.querySelector('section.chat')).toBeNull();
  });

  it('has no board chat in a solo room', async () => {
    game.playing.set(true);
    lobby.isSolo.set(true);
    const { el } = await render();
    expect(el.querySelector('app-board-chat')).toBeNull();
  });
});
