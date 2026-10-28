import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../auth/auth.service';
import { CreateRoomDialog } from './create-room-dialog';
import { RoomsService } from './rooms.service';

describe('CreateRoomDialog', () => {
  const rooms = { create: jest.fn() };
  const dialogRef = { close: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [CreateRoomDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { seatLimits: { min: 2, max: 8 }, displayName: 'Ann' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CreateRoomDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }


  const clickIdentity = (fixture: { detectChanges(): void }, el: HTMLElement) => {
    const radio = [...el.querySelectorAll('.deck mat-radio-button')].find((r) => r.textContent!.trim() === 'Identity')!;
    (radio.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    rooms.create.mockReset();
    dialogRef.close.mockReset();
  });

  it('offers the seat counts the server allows, starting at 4', async () => {
    const { el, component } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Create Room');
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(component.seatCount()).toBe(4);
  });

  it('offers First Reveal Bonus only at 5 seats or more', async () => {
    const { fixture, component, el } = await create();
    expect(el.querySelector('.first-reveal')).toBeNull();
    component.seatCount.set(5);
    fixture.detectChanges();
    expect(el.querySelector('.first-reveal')?.textContent).toContain('First Reveal Bonus');
  });

  it('creates the room and closes with its id', async () => {
    rooms.create.mockResolvedValue('r-new');
    const { component } = await create();
    component.seatCount.set(6);
    component.firstRevealDraw.set(false);
    await component.submit();
    expect(rooms.create).toHaveBeenCalledWith({ seatCount: 6, rules: { firstRevealDraw: false }, displayName: 'Ann' });
    expect(dialogRef.close).toHaveBeenCalledWith('r-new');
  });

  it('sends no rules below 5 seats', async () => {
    rooms.create.mockResolvedValue('r-new');
    const { component } = await create();
    await component.submit();
    expect(rooms.create).toHaveBeenCalledWith({ seatCount: 4, rules: {}, displayName: 'Ann' });
  });

  it("stays open with the server's message on failure", async () => {
    rooms.create.mockRejectedValue(new ApiError('already_in_room', "You're already in another room. Leave it first", 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent).toContain("You're already in another room. Leave it first");
  });

  it('offers the deck at every seat count, with Kingdom Wars chosen', async () => {
    const { fixture, component, el } = await create();
    expect([...el.querySelectorAll('.deck mat-radio-button')].map((r) => r.textContent!.trim())).toEqual(['Kingdom Wars', 'Identity']);
    component.seatCount.set(6);
    fixture.detectChanges();
    expect(el.querySelectorAll('.deck mat-radio-button')).toHaveLength(2);
  });

  it('sends no deck rule for Kingdom Wars, the default, beside First Reveal Bonus from 5 seats; Identity is disabled for now (deferred)', async () => {
    rooms.create.mockResolvedValue('r-new');
    const { fixture, component, el } = await create();
    clickIdentity(fixture, el);
    await component.submit();
    expect(rooms.create).toHaveBeenLastCalledWith({ seatCount: 4, rules: {}, displayName: 'Ann' });
    component.seatCount.set(6);
    component.firstRevealDraw.set(false);
    await component.submit();
    expect(rooms.create).toHaveBeenLastCalledWith({ seatCount: 6, rules: { firstRevealDraw: false }, displayName: 'Ann' });
  });
});
