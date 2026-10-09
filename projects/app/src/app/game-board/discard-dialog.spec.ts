import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardInstance } from 'engine';
import { DiscardDialog } from './discard-dialog';

const hand: CardInstance[] = [
  { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 },
  { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 },
  { instanceId: 'c3', definitionId: 'peach', suit: 'heart', rank: 12 },
];

function render(count: number) {
  const close = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { cards: hand, count } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(DiscardDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const card = (id: string) => el.querySelector(`button.card[data-card-id="${id}"]`) as HTMLButtonElement;
  const discard = () => el.querySelector('button.discard') as HTMLButtonElement;
  const click = (b: HTMLButtonElement) => { b.click(); fixture.detectChanges(); };
  return { el, card, discard, click, close };
}

describe('DiscardDialog', () => {
  it('lists every hand card and says how many must go', () => {
    const { el } = render(2);
    expect(el.querySelectorAll('button.card')).toHaveLength(3);
    // The same card face as in the hand.
    expect(el.querySelector('button.card[data-card-id="c3"] app-playing-card .name')!.textContent).toBe('Peach');
    expect(el.querySelector('button.card[data-card-id="c3"] app-playing-card .face')!.textContent).toBe('Q ♥');
    expect(el.querySelector('h2')!.textContent).toContain('Discard 2 Cards');
    expect(el.textContent).toContain('0/2 chosen');
  });

  it('checks and unchecks cards, and enables Discard only at exactly the count', () => {
    const { el, card, discard, click } = render(2);
    expect(discard().disabled).toBe(true);
    click(card('c1'));
    expect(card('c1').classList).toContain('checked');
    expect(card('c1').getAttribute('aria-pressed')).toBe('true');
    expect(discard().disabled).toBe(true);
    click(card('c3'));
    expect(discard().disabled).toBe(false);
    expect(el.textContent).toContain('2/2 chosen');
    // Full: the unchecked card can't be added, but a checked one can be dropped.
    expect(card('c2').disabled).toBe(true);
    click(card('c1'));
    expect(card('c1').classList).not.toContain('checked');
    expect(discard().disabled).toBe(true);
  });

  it('closes with the checked cards, in hand order, when Discard is pressed', () => {
    const { card, discard, click, close } = render(2);
    click(card('c3'));
    click(card('c1'));
    click(discard());
    expect(close).toHaveBeenCalledWith(['c1', 'c3']);
  });

  it('offers no way out other than Discard', () => {
    const { el } = render(1);
    expect([...el.querySelectorAll('mat-dialog-actions button')].map((b) => b.textContent!.trim())).toEqual(['delete Discard']);
  });
});
