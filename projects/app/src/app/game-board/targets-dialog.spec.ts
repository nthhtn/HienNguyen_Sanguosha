import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GameState } from 'engine';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';

const state = { players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }] } as unknown as GameState;

describe('TargetsDialog', () => {
  let closed: (string[] | undefined)[];
  let el: HTMLElement;
  const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
  const button = (text: string) => buttons().find((b) => b.textContent!.trim() === text)!;

  beforeEach(() => {
    closed = [];
    const data: TargetsDialogData = { title: 'Sha', pick: { eligibleIds: ['seat-0', 'seat-2', 'seat-3'], min: 1, max: 2 }, state };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: (ids?: string[]) => closed.push(ids) } },
      ],
    });
    const fixture = TestBed.createComponent(TargetsDialog);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    (el as unknown as { fixture: typeof fixture }).fixture = fixture;
  });
  const refresh = () => (el as unknown as { fixture: { detectChanges(): void } }).fixture.detectChanges();

  it('asks for up to N targets, one button per eligible seat, by name', () => {
    expect(el.querySelector('h2')!.textContent).toBe('Choose Targets');
    expect(el.textContent).toContain('Choose up to 2 targets for Sha');
    expect(buttons().map((b) => b.textContent!.trim())).toEqual(['Hing', 'Seat 2', 'Seat 3', 'Cancel', 'Confirm']);
  });

  it('Confirm waits for the minimum; once the maximum is picked the other seats are disabled', () => {
    expect(button('Confirm').disabled).toBe(true);
    button('Seat 3').click();
    refresh();
    expect(button('Confirm').disabled).toBe(false);
    button('Hing').click();
    refresh();
    expect(button('Seat 2').disabled).toBe(true);
    button('Hing').click(); // unpick
    refresh();
    expect(button('Seat 2').disabled).toBe(false);
  });

  it('Confirm closes with the seats in seat order; Cancel with nothing', () => {
    button('Seat 3').click();
    button('Hing').click();
    refresh();
    button('Confirm').click();
    expect(closed).toEqual([['seat-0', 'seat-3']]);
    button('Cancel').click();
    expect(closed[1]).toBeUndefined();
  });
});
