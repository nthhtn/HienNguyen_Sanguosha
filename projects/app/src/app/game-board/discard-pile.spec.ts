import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { DiscardPile } from './discard-pile';
import { DiscardHistoryEntry } from './discard-history';

const shan: CardInstance = { instanceId: 'd1', definitionId: 'shan', suit: 'heart', rank: 2 };
const peach: CardInstance = { instanceId: 'd2', definitionId: 'peach', suit: 'heart', rank: 12 };
const sha: CardInstance = { instanceId: 'd3', definitionId: 'sha', suit: 'spade', rank: 7 };

function render(cards: CardInstance[], history: DiscardHistoryEntry[]) {
  const fixture = TestBed.createComponent(DiscardPile);
  fixture.componentRef.setInput('cards', cards);
  fixture.componentRef.setInput('history', history);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;

async function openDialog(fixture: ReturnType<typeof render>['fixture'], el: HTMLElement) {
  (el.querySelector('button.pile') as HTMLButtonElement).click();
  fixture.detectChanges();
  await fixture.whenStable();
  return overlay().querySelector('app-discard-history-dialog')!;
}

describe('DiscardPile', () => {
  afterEach(() => overlay()?.replaceChildren());

  it('shows only the most recently discarded card, with the pile count', () => {
    const { el } = render([peach, sha], []);
    const arts = el.querySelectorAll('app-card-art img');
    expect(arts).toHaveLength(1);
    expect(arts[0].getAttribute('src')).toBe('/card-art/cards/cropped/basic/sha.jpg');
    expect(el.querySelector('.count')!.textContent).toContain('2');
    expect(el.querySelector('.top-name')!.textContent).toContain('Sha');
  });

  it('shows an empty placeholder, not a button, before anything is discarded', () => {
    const { el } = render([], []);
    expect(el.querySelector('.pile.empty')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('opens the whole discard history on click, most recent first, older cards past a reshuffle dimmed', async () => {
    const history: DiscardHistoryEntry[] = [
      { kind: 'card', card: sha, inPile: true },
      { kind: 'card', card: peach, inPile: true },
      { kind: 'reshuffle', cardCount: 1 },
      { kind: 'card', card: shan, inPile: false },
    ];
    const { fixture, el } = render([peach, sha], history);
    const dialog = await openDialog(fixture, el);
    expect(dialog.textContent).toContain('2 in the pile · 3 discarded this game');
    const items = [...dialog.querySelectorAll('.history > li')].map((li) => li.getAttribute('data-card-id') ?? 'reshuffle');
    expect(items).toEqual(['d3', 'd2', 'reshuffle', 'd1']);
    expect(dialog.querySelector('.reshuffle')!.textContent).toContain('1 card shuffled into the draw pile');
    expect(dialog.querySelectorAll('.entry').length).toBe(3);
    // Nothing to pick in the list, so no entry is singled out.
    expect(dialog.querySelector('.latest')).toBeNull();
    expect(dialog.querySelector('.entry.gone')!.getAttribute('data-card-id')).toBe('d1');
    expect(dialog.querySelector('[data-card-id="d2"] app-playing-card .face')!.textContent).toBe('Q ♥');
    expect(dialog.querySelector('[data-card-id="d2"] app-playing-card .name')!.textContent).toBe('Peach');
  });

  it('keeps the open history up to date as more cards are discarded', async () => {
    const { fixture, el } = render([sha], [{ kind: 'card', card: sha, inPile: true }]);
    const dialog = await openDialog(fixture, el);
    fixture.componentRef.setInput('cards', [sha, peach]);
    fixture.componentRef.setInput('history', [{ kind: 'card', card: peach, inPile: true }, { kind: 'card', card: sha, inPile: true }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.textContent).toContain('2 in the pile');
    expect(dialog.querySelector('.entry')!.getAttribute('data-card-id')).toBe('d2');
  });

  it('still opens the history when a reshuffle has just emptied the pile', async () => {
    const { fixture, el } = render([], [{ kind: 'reshuffle', cardCount: 1 }, { kind: 'card', card: shan, inPile: false }]);
    const dialog = await openDialog(fixture, el);
    expect(dialog.querySelectorAll('.entry')).toHaveLength(1);
  });
});
