import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { ActionHistoryPanel } from './action-history-panel';
import { ActionHistoryEntry } from './action-history';

const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const history: ActionHistoryEntry[] = [
  { kind: 'action', text: 'seat-1 took 1 damage from seat-0', card: null },
  { kind: 'action', text: 'seat-0 used Sha (7 ♠) on seat-1', card: sha },
  { kind: 'turn', turnNumber: 2, seatName: 'Seat 0' },
  { kind: 'action', text: 'seat-1 drew 2 cards', card: null },
];

function render(entries: ActionHistoryEntry[]) {
  const fixture = TestBed.createComponent(ActionHistoryPanel);
  fixture.componentRef.setInput('history', entries);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;

describe('ActionHistoryPanel', () => {
  afterEach(() => overlay()?.replaceChildren());

  it('shows only the latest action', () => {
    const { el } = render(history);
    expect(el.querySelector('.text')!.textContent).toContain('seat-1 took 1 damage from seat-0');
    expect(el.textContent).not.toContain('used Sha');
  });

  it('shows the card when the latest action used one', () => {
    const { el } = render(history.slice(1));
    expect(el.querySelector('app-card-art img')!.getAttribute('src')).toBe('/card-art/cards/cropped/basic/sha.jpg');
  });

  it('says so when nothing has happened yet', () => {
    expect(render([]).el.textContent).toContain('Nothing yet');
  });

  it('opens the whole history on click, newest first, with turn markers, and keeps it live', async () => {
    const { fixture, el } = render(history);
    (el.querySelector('button.latest') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-action-history-dialog')!;
    const rows = [...dialog.querySelectorAll('.history > li')].map((li) => li.textContent!.trim());
    expect(rows).toEqual([
      'seat-1 took 1 damage from seat-0',
      'seat-0 used Sha (7 ♠) on seat-1',
      'flag Turn 2 · Seat 0',
      'seat-1 drew 2 cards',
    ]);

    // Nothing to pick in the list, so no entry is singled out.
    expect(dialog.querySelector('.latest')).toBeNull();

    fixture.componentRef.setInput('history', [{ kind: 'action', text: 'seat-1 was eliminated', card: null }, ...history]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.querySelector('.entry')!.textContent).toContain('seat-1 was eliminated');
  });
});
