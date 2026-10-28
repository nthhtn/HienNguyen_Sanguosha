import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { SelectionDialog, SelectionDialogData } from './selection-dialog';
import { SelectionDescription } from './ability-description';

const template = { kind: 'SelectAction' as const, seatId: 'seat-0', selectionId: 's1', ids: [] };
const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
const c = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'spade', rank: 7 });

function render(over: Partial<SelectionDescription> = {}) {
  const close = jest.fn();
  const description: SelectionDescription = {
    title: 'Axe', prompt: 'Choose 2 cards to discard', confirmLabel: 'Discard', cancelLabel: 'Cancel', min: 2, max: 2,
    items: [{ id: 'a', card: c('a'), label: 'Slash (7 ♠)' }, { id: 'b', card: c('b'), label: 'Slash (7 ♠)' }, { id: 'x', card: c('x'), label: 'Slash (7 ♠)' }],
    template, cancel, ...over,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { description } satisfies SelectionDialogData },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(SelectionDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { el, click, close };
}

describe('SelectionDialog', () => {
  it('has a View Board button to minimize it', () => {
    const { el } = render();
    expect(el.querySelector('app-minimize-button')).not.toBeNull();
  });

  it('confirms only once between min and max are picked, with the picked ids', () => {
    const { el, click, close } = render();
    const confirm = () => el.querySelector('button.confirm') as HTMLButtonElement;
    expect(confirm().textContent!.trim()).toBe('Discard');
    expect(confirm().disabled).toBe(true);
    click('[data-item-id="a"]');
    expect(confirm().disabled).toBe(true);
    click('[data-item-id="x"]');
    expect(confirm().disabled).toBe(false);
    click('[data-item-id="b"]'); // a third is ignored at max
    expect(el.querySelectorAll('.item.picked')).toHaveLength(2);
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, ids: ['a', 'x'] });
  });

  it('a picked item can be unpicked', () => {
    const { el, click } = render();
    click('[data-item-id="a"]');
    click('[data-item-id="a"]');
    expect(el.querySelectorAll('.item.picked')).toHaveLength(0);
  });

  it('offers Cancel only when it may be cancelled', () => {
    const { click, close } = render();
    click('button.cancel');
    expect(close).toHaveBeenCalledWith(cancel);
    TestBed.resetTestingModule();
    expect(render({ cancel: null }).el.querySelector('button.cancel')).toBeNull();
  });

  it('shows seats by name', () => {
    const { el } = render({ items: [{ id: 'seat-2', label: 'Seat 2' }], min: 1, max: 2 });
    expect(el.querySelector('[data-item-id="seat-2"]')!.textContent).toContain('Seat 2');
  });
});
