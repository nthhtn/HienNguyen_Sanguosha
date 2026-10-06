import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { AskDialog, AskDialogData } from './ask-dialog';

const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'use' };
const decline: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'decline' };

function render() {
  const close = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          description: { title: 'Axe', prompt: 'Use Axe on Seat 1?', hint: 'Discard 2 cards to make your Sha hit Seat 1', card: { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 }, use, decline },
        } satisfies AskDialogData,
      },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(AskDialog);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, close };
}

describe('AskDialog', () => {
  it('shows the ability, the question, what it does, and the worn card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Axe');
    expect(el.querySelector('.prompt')!.textContent).toContain('Use Axe on Seat 1?');
    expect(el.querySelector('.hint')!.textContent).toContain('Discard 2 cards to make your Sha hit Seat 1');
    expect(el.querySelector('app-playing-card')).not.toBeNull();
  });

  it('closes with Use or Don’t', () => {
    const { el, close } = render();
    (el.querySelector('button.use') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(use);
    expect(el.querySelector('button.decline')!.textContent!.trim()).toBe("Don't");
    (el.querySelector('button.decline') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(decline);
  });
});
