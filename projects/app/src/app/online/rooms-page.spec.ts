import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import type { Me, RoomList } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { CreateRoomDialog } from './create-room-dialog';
import { JoinRoomDialog } from './join-room-dialog';
import { PlayVsBotsDialog } from './play-vs-bots-dialog';
import { OnlineNotice } from './online-notice';
import { RoomsPage } from './rooms-page';
import { RoomsService } from './rooms.service';

const ANN: Me = { id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' };
const GUS: Me = { id: 'u2', kind: 'guest', displayName: 'Gus' };
const LIST: RoomList = {
  rooms: [
    { id: 'r-mine', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true },
    { id: 'r-open', visibility: 'open', hostName: 'Bo', memberCount: 2, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-full', visibility: 'open', hostName: 'Cy', memberCount: 4, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-playing', visibility: 'open', hostName: 'Di', memberCount: 3, capacity: 3, status: 'playing', youAreMember: false },
  ],
  seatLimits: { min: 2, max: 8 },
};

describe('RoomsPage', () => {
  const list = signal<RoomList | null>(null);
  const error = signal<string | null>(null);
  const rooms = { list, error, startPolling: jest.fn(), stopPolling: jest.fn() };
  const me = signal<Me | null>(ANN);
  const auth = { me, isRegistered: computed(() => me()?.kind === 'registered') };
  const dialog = { open: jest.fn() };
  let notice: OnlineNotice;

  beforeEach(() => {
    list.set(LIST);
    error.set(null);
    me.set(ANN);
    rooms.startPolling.mockClear();
    rooms.stopPolling.mockClear();
    dialog.open.mockReset();
    notice = new OnlineNotice();
  });

  async function create() {
    await TestBed.configureTestingModule({
      imports: [RoomsPage],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: AuthService, useValue: auth },
        { provide: MatDialog, useValue: dialog },
        { provide: OnlineNotice, useValue: notice },
        provideRouter([{ path: 'rooms/:id', children: [] }, { path: 'my-games', children: [] }]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RoomsPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  const row = (el: HTMLElement, host: string) => [...el.querySelectorAll('li.room')].find((li) => li.querySelector('.host-name')?.textContent?.trim() === host) as HTMLElement;

  it('polls the list while open, and stops when closed', async () => {
    const { fixture } = await create();
    expect(rooms.startPolling).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(rooms.stopPolling).toHaveBeenCalled();
  });

  it('shows each room with its host, count and status, and Join only where there is space', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Rooms');
    const open = row(el, 'Bo');
    expect(open.querySelector('.count')?.textContent?.trim()).toBe('2 / 4');
    expect(open.querySelector('.status')?.textContent?.trim()).toBe('Waiting for Players');
    expect((open.querySelector('button.join') as HTMLButtonElement).disabled).toBe(false);
    expect(row(el, 'Cy').querySelector('.status')?.textContent?.trim()).toBe('Full');
    expect((row(el, 'Cy').querySelector('button.join') as HTMLButtonElement).disabled).toBe(true);
    expect(row(el, 'Di').querySelector('.status')?.textContent?.trim()).toBe('In Progress');
    expect((row(el, 'Di').querySelector('button.join') as HTMLButtonElement).disabled).toBe(true);
  });

  it('pins your own rooms with Rejoin, which opens the Lobby', async () => {
    const { el, fixture, router } = await create();
    const mine = el.querySelector('li.room') as HTMLElement;
    expect(mine.classList).toContain('mine');
    expect(mine.querySelector('button.join')).toBeNull();
    (mine.querySelector('button.rejoin') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/rooms/r-mine');
  });

  it('asks for a name on Join, then opens the Lobby', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const { el, fixture, router } = await create();
    (row(el, 'Bo').querySelector('button.join') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(dialog.open).toHaveBeenCalledWith(JoinRoomDialog, expect.objectContaining({ data: { roomId: 'r-open', hostName: 'Bo', displayName: 'Ann' } }));
    expect(router.url).toBe('/rooms/r-open');
  });

  it('stays on Rooms when the Join dialog is cancelled', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const { el, fixture, router } = await create();
    (row(el, 'Bo').querySelector('button.join') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('Create Room opens the dialog with the seat limits, then the new Lobby', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of('r-new') });
    const { el, fixture, router } = await create();
    const button = el.querySelector('button.create') as HTMLButtonElement;
    expect(button.textContent).toContain('Create Room');
    button.click();
    await fixture.whenStable();
    expect(dialog.open).toHaveBeenCalledWith(CreateRoomDialog, expect.objectContaining({ data: { seatLimits: { min: 2, max: 8 }, displayName: 'Ann' } }));
    expect(router.url).toBe('/rooms/r-new');
  });

  it('opens Play vs Bots with the seat limits, and goes to the new room', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of('r-solo') });
    const { el, router } = await create();
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = el.querySelector('button.play-vs-bots') as HTMLButtonElement;
    expect(button.textContent).toContain('Play vs Bots');
    expect(button.disabled).toBe(false);
    button.click();
    expect(dialog.open).toHaveBeenCalledWith(PlayVsBotsDialog, expect.objectContaining({ data: { seatLimits: LIST.seatLimits, existingRoomId: null } }));
    expect(navigate).toHaveBeenCalledWith(['/rooms', 'r-solo']);
  });

  it('lets a guest play vs bots, and names a running game against bots as such', async () => {
    me.set(GUS);
    list.set({ ...LIST, rooms: [{ id: 'r-solo', visibility: 'solo', hostName: null, memberCount: 3, capacity: 3, status: 'playing', youAreMember: true }, ...LIST.rooms] });
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const { el } = await create();
    expect(row(el, 'Play vs Bots')).toBeTruthy();
    (el.querySelector('button.play-vs-bots') as HTMLButtonElement).click();
    expect(dialog.open).toHaveBeenCalledWith(PlayVsBotsDialog, expect.objectContaining({ data: { seatLimits: LIST.seatLimits, existingRoomId: 'r-solo' } }));
  });

  it('links registered players to My Games, and shows guests no link', async () => {
    const registered = await create();
    const link = registered.el.querySelector('a.my-games') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/my-games');
    expect(link.textContent).toContain('My Games');
    TestBed.resetTestingModule();
    me.set(GUS);
    const guest = await create();
    expect(guest.el.querySelector('a.my-games')).toBeNull();
  });

  it('disables Create Room for a guest, and says why', async () => {
    me.set(GUS);
    const { el } = await create();
    expect((el.querySelector('button.create') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('.host-hint')?.textContent?.trim()).toBe('Sign in to host a room');
  });

  it('shows the hint to nobody registered', async () => {
    const { el } = await create();
    expect(el.querySelector('.host-hint')).toBeNull();
  });

  it('says so when there are no rooms', async () => {
    list.set({ rooms: [], seatLimits: { min: 2, max: 8 } });
    const { el } = await create();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No rooms yet');
  });

  it('shows the notice the Lobby left, once', async () => {
    notice.show('The host closed the room');
    const { el } = await create();
    expect(el.querySelector('.notice')?.textContent?.trim()).toBe('The host closed the room');
    expect(notice.take()).toBeNull();
  });

  it('shows a load error', async () => {
    list.set(null);
    error.set("Can't reach the server. Check your connection and try again");
    const { el } = await create();
    expect(el.querySelector('.error')?.textContent).toContain("Can't reach the server");
  });
});
