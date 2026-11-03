import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { ActionHistoryEntry } from './action-history';
import { BoardPanel } from './board-panel';
import { DiscardHistoryEntry } from './discard-history';

const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const actions: ActionHistoryEntry[] = [
  { kind: 'action', text: 'Seat 3 used Sha (7 ♠) on Hing', card: sha },
  { kind: 'turn', turnNumber: 2, seatName: 'Seat 3' },
];
const discards: DiscardHistoryEntry[] = [{ kind: 'card', card: sha, inPile: true }];

function render(actionHistory: ActionHistoryEntry[], discardHistory: DiscardHistoryEntry[]) {
  const fixture = TestBed.createComponent(BoardPanel);
  fixture.componentRef.setInput('actionHistory', actionHistory);
  fixture.componentRef.setInput('discardHistory', discardHistory);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const tabs = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')] as HTMLElement[];

describe('BoardPanel', () => {
  it('has an Action History tab, selected first, and a Discard Pile tab', () => {
    const { el } = render(actions, discards);
    expect(tabs(el).map((t) => t.textContent!.trim())).toEqual(['Action History', 'Discard Pile']);
    expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('app-action-history-list')).not.toBeNull();
    expect(el.querySelector('app-action-history-list')!.textContent).toContain('Seat 3 used Sha (7 ♠) on Hing');
  });

  it('switches to the discard pile', async () => {
    const { fixture, el } = render(actions, discards);
    tabs(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('app-discard-history-list li')).not.toBeNull();
  });

  it('says so when nothing has happened yet', () => {
    const { el } = render([], []);
    expect(el.textContent).toContain('Nothing has happened yet');
  });
});
