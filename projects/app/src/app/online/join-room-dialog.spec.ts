import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../auth/auth.service';
import { JoinRoomDialog } from './join-room-dialog';
import { RoomsService } from './rooms.service';

describe('JoinRoomDialog', () => {
  const rooms = { join: jest.fn() };
  const dialogRef = { close: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [JoinRoomDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { roomId: 'r1', hostName: 'Bo', displayName: 'Ann' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(JoinRoomDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    rooms.join.mockReset();
    dialogRef.close.mockReset();
  });

  it('asks only for Your Name, filled in with the display name', async () => {
    const { el } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Join Room');
    expect(el.querySelector('mat-label')?.textContent).toContain('Your Name');
    expect((el.querySelector('input.name') as HTMLInputElement).value).toBe('Ann');
    expect(el.textContent).toContain('Hosted by Bo');
  });

  it('joins with the name and closes', async () => {
    rooms.join.mockResolvedValue(undefined);
    const { component } = await create();
    component.displayName.set('Annie');
    await component.submit();
    expect(rooms.join).toHaveBeenCalledWith('r1', 'Annie');
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("stays open with the server's message when the name is refused", async () => {
    rooms.join.mockRejectedValue(new ApiError('name_taken', 'That name is already taken in this room. Choose another.', 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent).toContain('That name is already taken in this room. Choose another.');
  });

  it('disables Join for a blank name', async () => {
    const { fixture, component, el } = await create();
    component.displayName.set('   ');
    fixture.detectChanges();
    expect((el.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(true);
  });
});
