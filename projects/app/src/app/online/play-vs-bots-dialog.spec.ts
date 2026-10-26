import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { RoomList, RoomListItem } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { PlayVsBotsDialog, PlayVsBotsDialogData } from './play-vs-bots-dialog';
import { RoomsService } from './rooms.service';

describe('PlayVsBotsDialog', () => {
  const rooms = { createSolo: jest.fn(), refresh: jest.fn(), list: jest.fn() };
  const listing = (rooms: Partial<RoomListItem>[]): RoomList => ({
    seatLimits: { min: 2, max: 8 },
    rooms: rooms.map((room) => ({ id: 'r', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: false, ...room })),
  });
  const dialogRef = { close: jest.fn() };

  async function create(existingRoomId: string | null = null) {
    const data: PlayVsBotsDialogData = { seatLimits: { min: 2, max: 8 }, existingRoomId };
    await TestBed.configureTestingModule({
      imports: [PlayVsBotsDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlayVsBotsDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }


  const pickDefault = (fixture: { detectChanges(): void }, el: HTMLElement) => {
    const radio = [...el.querySelectorAll('.deck mat-radio-button')].find((r) => r.textContent!.trim() === 'Dynasty Wars')!;
    (radio.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    rooms.createSolo.mockReset();
    rooms.refresh.mockReset().mockResolvedValue(undefined);
    rooms.list.mockReset().mockReturnValue(listing([]));
    dialogRef.close.mockReset();
  });

  it('offers the seat counts the server allows, and starts a game against bots', async () => {
    rooms.createSolo.mockResolvedValue('r-solo');
    const { el, component } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Play vs Bots');
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(component.seatCount()).toBe(4);
    component.seatCount.set(5);
    await component.submit();
    expect(rooms.createSolo).toHaveBeenCalledWith({ seatCount: 5, rules: { deck: 'alternate', firstRevealDraw: true } });
    expect(dialogRef.close).toHaveBeenCalledWith('r-solo');
  });

  it('offers Resume Game or Abandon and Start New when a game against bots is running', async () => {
    rooms.createSolo.mockResolvedValue('r-new');
    const { fixture, component, el } = await create('r-old');
    expect(el.querySelector('.in-progress')?.textContent?.trim()).toBe('You have a game against bots in progress');
    expect(el.querySelector('.seats')).toBeNull();
    (el.querySelector('button.resume') as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith('r-old');
    (el.querySelector('button.abandon') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.seats')).not.toBeNull();
    await component.submit();
    expect(rooms.createSolo).toHaveBeenCalledWith({ seatCount: 4, rules: { deck: 'alternate' }, replace: true });
  });

  it("stays open with the server's message when it refuses", async () => {
    rooms.createSolo.mockRejectedValue(new ApiError('solo_exists', 'You already have a game against bots in progress', 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('You already have a game against bots in progress');
  });

  it('offers Resume Game or Abandon and Start New when Start Game finds one already running', async () => {
    rooms.createSolo.mockRejectedValueOnce(new ApiError('solo_exists', 'You already have a game against bots in progress', 409));
    rooms.list.mockReturnValue(
      listing([
        { id: 'r-open', visibility: 'open', status: 'playing', youAreMember: true },
        { id: 'r-done', visibility: 'solo', status: 'lobby', youAreMember: true },
        { id: 'r-solo', visibility: 'solo', status: 'playing', youAreMember: true },
      ])
    );
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(rooms.refresh).toHaveBeenCalled();
    expect(el.querySelector('.in-progress')?.textContent?.trim()).toBe('You have a game against bots in progress');
    expect(el.querySelector('.error')).toBeNull();
    (el.querySelector('button.resume') as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith('r-solo');
    (el.querySelector('button.abandon') as HTMLButtonElement).click();
    fixture.detectChanges();
    rooms.createSolo.mockResolvedValue('r-new');
    await component.submit();
    expect(rooms.createSolo).toHaveBeenLastCalledWith({ seatCount: 4, rules: { deck: 'alternate' }, replace: true });
    expect(dialogRef.close).toHaveBeenLastCalledWith('r-new');
  });

  it('offers the deck and sends the chosen one', async () => {
    rooms.createSolo.mockResolvedValue('r-solo');
    const { fixture, component, el } = await create();
    expect([...el.querySelectorAll('.deck mat-radio-button')].map((r) => r.textContent!.trim())).toEqual(['Kingdom Wars', 'Dynasty Wars']);
    pickDefault(fixture, el);
    await component.submit();
    expect(rooms.createSolo).toHaveBeenLastCalledWith({ seatCount: 4, rules: {} });
  });
});
