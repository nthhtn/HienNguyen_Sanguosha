import { readFileSync } from 'fs';
import { join } from 'path';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { ChoiceDialog, ChoiceDialogData } from './choice-dialog';

const pickHand: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c1', optionId: 'hand' };
const pickLion: Action = { ...pickHand, optionId: 'lion-1' };

function render() {
  const close = jest.fn();
  const pickedChanged = jest.fn();
  const data: ChoiceDialogData = {
    description: { title: 'Steal', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' },
    options: [
      { id: 'hand#1', action: pickHand, faceDown: true, label: 'Hand Card 1' },
      { id: 'hand#2', action: pickHand, faceDown: true, label: 'Hand Card 2' },
      { id: 'lion-1', action: pickLion, card: { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 }, label: 'Silver Lion (A ♣)' },
    ],
    pickedChanged,
  };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(ChoiceDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close, pickedChanged };
}

describe('ChoiceDialog', () => {
  it('has a View Board button to minimize it', () => {
    const { el } = render();
    expect(el.querySelector('app-minimize-button')).not.toBeNull();
  });

  it('shows the Tool, the prompt, each hand card face down, and each face-up card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Steal');
    expect(el.querySelector('.prompt')!.textContent).toContain('Choose a card to take from Seat 1');
    const backs = Array.from(el.querySelectorAll('img.card-back')) as HTMLImageElement[];
    expect(backs.map((b) => b.getAttribute('src'))).toEqual(['/images/playing-cards/back.jpg', '/images/playing-cards/back.jpg']);
    expect(el.querySelector('[data-option-id="hand#2"] .label')!.textContent!.trim()).toBe('Hand Card 2');
    expect(el.querySelector('[data-option-id="lion-1"] app-playing-card')).not.toBeNull();
  });

  it('takes nothing until a card is picked, then closes with that pick', () => {
    const { el, fixture, close, pickedChanged } = render();
    const confirm = el.querySelector('button.confirm') as HTMLButtonElement;
    expect(confirm.textContent!.trim()).toBe('Take');
    expect(confirm.disabled).toBe(true);
    (el.querySelector('[data-option-id="lion-1"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pickedChanged).toHaveBeenCalledWith(pickLion);
    expect(confirm.disabled).toBe(false);
    confirm.click();
    expect(close).toHaveBeenCalledWith(pickLion);
  });

  it('highlights only the face-down card picked, though all of them pick the hand', () => {
    const { el, fixture, pickedChanged } = render();
    (el.querySelector('[data-option-id="hand#2"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pickedChanged).toHaveBeenCalledWith(pickHand);
    expect(Array.from(el.querySelectorAll('.option.picked')).map((b) => b.getAttribute('data-option-id'))).toEqual(['hand#2']);
  });

  it('shows a seat with its portrait instead of a colour swatch, and a face-down General as the card back', () => {
    const pickSeat: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' };
    const pickGeneral: Action = { ...pickSeat, optionId: 'hidden-general' };
    const data: ChoiceDialogData = {
      description: { title: 'Pick', prompt: 'Choose a seat', confirmLabel: 'Choose' },
      options: [
        { id: 'seat-1', action: pickSeat, label: 'Seat 1', force: 'Wei', generals: { main: { generalDefinitionId: 'cao-cao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } },
        { id: 'hidden-general', action: pickGeneral, label: 'Hidden General', generalId: 'hidden' },
      ],
    };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
    const fixture = TestBed.createComponent(ChoiceDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const seat = el.querySelector('[data-option-id="seat-1"]')!;
    expect(seat.querySelector('app-seat-portrait')).not.toBeNull();
    expect(seat.querySelector('.swatch')).toBeNull();
    expect(seat.getAttribute('aria-label')).toBe('Seat 1');
    expect(el.querySelector('[data-option-id="hidden-general"] img')!.getAttribute('src')).toBe('/images/generals/special/hidden.jpg');
  });

  it('shows a seat in its force colour, and a suit in its colour', () => {
    const close = jest.fn();
    const pickSeat: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' };
    const pickHeart: Action = { ...pickSeat, optionId: 'heart' };
    const data: ChoiceDialogData = {
      description: { title: 'Sow Revolt', prompt: 'Name a suit', confirmLabel: 'Choose' },
      options: [{ id: 'seat-1', action: pickSeat, label: 'Seat 1', force: 'Wu' }, { id: 'heart', action: pickHeart, label: '♥ Heart', suit: 'heart' }],
    };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
    const fixture = TestBed.createComponent(ChoiceDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-option-id="seat-1"]')!.getAttribute('data-force')).toBe('Wu');
    expect(el.querySelector('[data-option-id="heart"]')!.classList).toContain('red-suit');
    expect(el.querySelector('button.confirm')!.textContent!.trim()).toBe('Choose');
  });

  it('shows an Ambitionist seat in purple, not the yellow of a seat with no force', () => {
    const pick: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' };
    const data: ChoiceDialogData = {
      description: { title: 'Pick', prompt: 'Pick a seat', confirmLabel: 'Choose' },
      options: [{ id: 'seat-1', action: pick, label: 'Seat 1', force: 'Ambitionist' }],
    };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
    const fixture = TestBed.createComponent(ChoiceDialog);
    fixture.detectChanges();
    const option = (fixture.nativeElement as HTMLElement).querySelector('[data-option-id="seat-1"]')!;
    expect(option.getAttribute('data-force')).toBe('Ambitionist');
 // jsdom neither cascades custom properties nor keeps component styles, so read the stylesheet from the source: it must give this force its colour.
    const styles = readFileSync(join(__dirname, 'choice-dialog.ts'), 'utf8');
    expect(styles).toContain(".option[data-force='Ambitionist'] { --force: var(--force-ambitionist)");
  });
});

describe('ChoiceDialog with a disabled option', () => {
  const pickDraw: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'pr', optionId: 'draw' };
  const pickRecover: Action = { ...pickDraw, optionId: 'recover' };

  function renderReward() {
    const close = jest.fn();
    const data: ChoiceDialogData = {
      description: { title: 'Synergistic Partners', prompt: 'Choose', confirmLabel: 'Choose' },
      options: [
        { id: 'recover', action: pickRecover, label: 'Recover 1 HP', disabled: true },
        { id: 'draw', action: pickDraw, label: 'Draw 2 Cards' },
      ],
    };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
    const fixture = TestBed.createComponent(ChoiceDialog);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, close };
  }

  it('shows the disabled option as a disabled button that cannot be picked', () => {
    const { el, fixture } = renderReward();
    const recover = el.querySelector('[data-option-id="recover"]') as HTMLButtonElement;
    expect(recover.disabled).toBe(true);
    recover.click();
    fixture.detectChanges();
    expect((el.querySelector('button.confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('still lets the enabled option be picked and confirmed', () => {
    const { el, fixture, close } = renderReward();
    (el.querySelector('[data-option-id="draw"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('button.confirm') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(pickDraw);
  });
});
