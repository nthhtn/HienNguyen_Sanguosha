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
  it('shows the Tool, the prompt, each hand card face down, and each face-up card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Steal');
    expect(el.querySelector('.prompt')!.textContent).toContain('Choose a card to take from Seat 1');
    const backs = Array.from(el.querySelectorAll('img.card-back')) as HTMLImageElement[];
    expect(backs.map((b) => b.getAttribute('src'))).toEqual(['/card-art/cards/back.jpg', '/card-art/cards/back.jpg']);
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
});
