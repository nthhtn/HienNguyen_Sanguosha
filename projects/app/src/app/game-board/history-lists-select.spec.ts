import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { ActionHistoryList } from './action-history-list';
import { DiscardHistoryList } from './discard-history-list';

const sha: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 };

describe('DiscardHistoryList selection', () => {
  function render(selectable: boolean, selectedId: string | null = null) {
    const fixture = TestBed.createComponent(DiscardHistoryList);
    fixture.componentRef.setInput('history', [{ kind: 'card', card: sha, inPile: true }, { kind: 'reshuffle', cardCount: 3 }, { kind: 'card', card: shan, inPile: false }]);
    fixture.componentRef.setInput('selectable', selectable);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
    const picked: CardInstance[] = [];
    fixture.componentInstance.cardSelected.subscribe((c) => picked.push(c));
    return { el: fixture.nativeElement as HTMLElement, picked };
  }

  it('is plain cards, with no buttons, when it is not selectable (the board panel)', () => {
    expect(render(false).el.querySelectorAll('button.card')).toHaveLength(0);
  });

  it('makes each card a button that says which card was chosen', () => {
    const { el, picked } = render(true);
    const buttons = el.querySelectorAll('button.card');
    expect(buttons).toHaveLength(2);
    (buttons[1] as HTMLButtonElement).click();
    expect(picked).toEqual([shan]);
  });

  it('marks the selected card', () => {
    const { el } = render(true, 'c2');
    expect(el.querySelector('button.card[aria-pressed="true"]')!.closest('li')!.getAttribute('data-card-id')).toBe('c2');
    expect(el.querySelectorAll('button.card[aria-pressed="true"]')).toHaveLength(1);
  });
});

describe('ActionHistoryList selection', () => {
  function render(selectable: boolean, selectedId: string | null = null) {
    const fixture = TestBed.createComponent(ActionHistoryList);
    fixture.componentRef.setInput('history', [
      { kind: 'action', text: 'Seat 1 used Slash (7 ♠) on Hing', card: sha },
      { kind: 'action', text: 'Hing passed', card: null },
    ]);
    fixture.componentRef.setInput('selectable', selectable);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
    const picked: CardInstance[] = [];
    fixture.componentInstance.cardSelected.subscribe((c) => picked.push(c));
    return { el: fixture.nativeElement as HTMLElement, picked };
  }

  it('is plain lines when it is not selectable', () => {
    expect(render(false).el.querySelectorAll('button.entry-card')).toHaveLength(0);
  });

  it('makes only the lines that carry a card clickable', () => {
    const { el, picked } = render(true);
    const buttons = el.querySelectorAll('button.entry-card');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Seat 1 used Slash');
    (buttons[0] as HTMLButtonElement).click();
    expect(picked).toEqual([sha]);
    expect(el.querySelectorAll('li.entry')).toHaveLength(2);
  });

  it('marks the selected line', () => {
    expect(render(true, 'c1').el.querySelector('button.entry-card[aria-pressed="true"]')).not.toBeNull();
    expect(render(true, 'other').el.querySelector('button.entry-card[aria-pressed="true"]')).toBeNull();
  });
});
