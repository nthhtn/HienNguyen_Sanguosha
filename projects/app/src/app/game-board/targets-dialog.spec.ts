import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GameState } from 'engine';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';

const seat = (id: string, kingdom: string, main: string, deputy: string, hp: number, maxHp: number, mainRevealed: boolean, deputyRevealed: boolean) => ({
  id, kingdom, combinedHp: hp, maxCombinedHp: maxHp, hand: { zoneId: `${id}:hand` },
  generals: { main: { generalDefinitionId: main, revealed: mainRevealed }, deputy: { generalDefinitionId: deputy, revealed: deputyRevealed } },
});
const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade', rank: 1 }));
const state = {
  players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }],
  seats: [
    seat('seat-0', 'hidden', 'hidden', 'hidden', 4, 4, false, false),
    seat('seat-2', 'Wei', 'cao-cao', 'hidden', 3, 4, true, false),
    seat('seat-3', 'hidden', 'hidden', 'hidden', 4, 4, false, false),
  ],
  zones: [
    { id: 'seat-0:hand', kind: 'hand', cards: cards(1) },
    { id: 'seat-2:hand', kind: 'hand', cards: cards(2) },
    { id: 'seat-3:hand', kind: 'hand', cards: cards(5) },
  ],
} as unknown as GameState;

describe('TargetsDialog', () => {
  let closed: (string[] | undefined)[];
  let el: HTMLElement;
  const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
  const button = (text: string) => buttons().find((b) => b.textContent!.trim() === text)!;
  const card = (name: string) => [...el.querySelectorAll('.pk')].find((c) => c.querySelector('.pk-name')!.textContent!.trim() === name) as HTMLButtonElement;

  beforeEach(() => {
    closed = [];
    const data: TargetsDialogData = { title: 'Slash', pick: { eligibleIds: ['seat-0', 'seat-2', 'seat-3'], min: 1, max: 2 }, state };
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

  it('asks for up to N targets, one card per eligible seat, by name', () => {
    expect(el.querySelector('h2')!.textContent).toBe('Choose Targets');
    expect(el.textContent).toContain('Choose up to 2 targets for Slash');
    expect([...el.querySelectorAll('.pk .pk-name')].map((n) => n.textContent)).toEqual(['Hing', 'Seat 2', 'Seat 3']);
    expect(buttons().filter((b) => !b.classList.contains('pk')).map((b) => b.textContent!.trim())).toEqual(['Cancel', 'Confirm']);
  });

  it('each card shows the portrait, the revealed Generals, HP and the number of hand cards', () => {
    expect(el.querySelectorAll('.pk app-seat-portrait').length).toBe(3);
    expect(card('Seat 2').querySelector('.pk-gens')!.textContent!.trim()).toBe('Cao Cao');
    expect(card('Seat 3').querySelector('.pk-gens')!.textContent!.trim()).toBe('Generals hidden');
    expect(card('Seat 2').querySelector('.hp')!.getAttribute('aria-label')).toBe('HP 3 of 4');
    expect(card('Seat 2').querySelectorAll('.hp app-hp-icons img').length).toBe(4);
    expect(card('Seat 2').querySelectorAll('.hp app-hp-icons img.lost').length).toBe(1);
    expect(card('Seat 2').querySelector('.hand')!.textContent!.trim()).toBe('2 cards');
    expect(card('Hing').querySelector('.hand')!.textContent!.trim()).toBe('1 card');
  });

  it('takes the force colour of a revealed seat, and none for a hidden one', () => {
    expect(card('Seat 2').getAttribute('data-force')).toBe('Wei');
    expect(card('Seat 3').getAttribute('data-force')).toBe('none');
  });

  it('names the seat and its Generals for a screen reader', () => {
    expect(card('Seat 2').getAttribute('aria-label')).toBe('Seat 2, Cao Cao');
    expect(card('Seat 3').getAttribute('aria-label')).toBe('Seat 3');
  });

  it('Confirm waits for the minimum; once the maximum is picked the other seats are disabled', () => {
    expect(button('Confirm').disabled).toBe(true);
    card('Seat 3').click();
    refresh();
    expect(button('Confirm').disabled).toBe(false);
    card('Hing').click();
    refresh();
    expect(card('Seat 2').disabled).toBe(true);
    card('Hing').click(); // unpick
    refresh();
    expect(card('Seat 2').disabled).toBe(false);
  });

  it('marks each pick with the order it was made in, and counts them', () => {
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('0 of 2 selected');
    card('Seat 3').click();
    refresh();
    card('Hing').click();
    refresh();
    expect(card('Seat 3').getAttribute('aria-pressed')).toBe('true');
    expect(card('Seat 3').querySelector('.badge')!.textContent!.trim()).toBe('1');
    expect(card('Hing').querySelector('.badge')!.textContent!.trim()).toBe('2');
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('2 of 2 selected');
  });

  it('Confirm closes with the seats in seat order; Cancel with nothing', () => {
    card('Seat 3').click();
    card('Hing').click();
    refresh();
    button('Confirm').click();
    expect(closed).toEqual([['seat-0', 'seat-3']]);
    button('Cancel').click();
    expect(closed[1]).toBeUndefined();
  });
});
