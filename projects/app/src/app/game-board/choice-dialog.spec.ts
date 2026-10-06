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
      { id: 'hand', action: pickHand, hiddenCount: 3, label: "Seat 1's Hand (3 Cards)" },
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
  it('shows the Tool, the prompt, a face-down hand with its size, and each face-up card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Steal');
    expect(el.querySelector('.prompt')!.textContent).toContain('Choose a card to take from Seat 1');
    expect(el.querySelector('[data-option-id="hand"] .card-back .count')!.textContent!.trim()).toBe('3');
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
});
