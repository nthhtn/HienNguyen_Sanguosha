import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { ArrangeDialog, ArrangeDialogData } from './arrange-dialog';

const cards: CardInstance[] = [
  { instanceId: 't1', definitionId: 'peach', suit: 'heart', rank: 3 },
  { instanceId: 't2', definitionId: 'duel', suit: 'spade', rank: 1 },
  { instanceId: 't3', definitionId: 'sha', suit: 'club', rank: 7 },
];
const template: Extract<Action, { kind: 'ArrangeCardsAction' }> = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };

function render() {
  const close = jest.fn();
  const arrangedChanged = jest.fn();
  const data: ArrangeDialogData = { description: { title: 'Astrology', prompt: 'Put each card…', cards, template }, arrangedChanged };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(ArrangeDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { el, close, arrangedChanged, click };
}

describe('ArrangeDialog', () => {
  it('starts with every card on top, in order', () => {
    const { el, close, click, arrangedChanged } = render();
    expect([...el.querySelectorAll('.item')].map((i) => i.getAttribute('data-card-id'))).toEqual(['t1', 't2', 't3']);
    expect(arrangedChanged).toHaveBeenLastCalledWith({ ...template, top: ['t1', 't2', 't3'], bottom: [] });
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, top: ['t1', 't2', 't3'], bottom: [] });
  });

  it('sends a card to the bottom, and moves cards along the row', () => {
    const { close, click, arrangedChanged } = render();
    click('[data-card-id="t2"] button.bottom');
    click('[data-card-id="t3"] button.left');
    expect(arrangedChanged).toHaveBeenLastCalledWith({ ...template, top: ['t1', 't3'], bottom: ['t2'] });
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, top: ['t1', 't3'], bottom: ['t2'] });
  });
});
