import { TestBed } from '@angular/core/testing';
import type { GameState } from 'engine';
import type { ResolutionNoticeContent } from 'content';
import { NOTICE_MS, ResolutionNotice } from './resolution-notice';

const seat = (id: string, kingdom: string, main: string, hp = 3) => ({
  id, kingdom, combinedHp: hp, maxCombinedHp: 4,
  generals: { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
});
const state = {
  players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }],
  seats: [seat('seat-0', 'Wu', 'zhou-yu'), seat('seat-1', 'Wei', 'cao-cao', 2)],
} as unknown as GameState;

const content = (over: Partial<ResolutionNoticeContent> = {}): ResolutionNoticeContent => ({
  source: { kind: 'card', id: 'blaze' },
  seatIds: ['seat-0', 'seat-1'],
  steps: [{ key: 'ui.confirm' }, { key: 'ui.cancel' }],
  cards: [{ card: { instanceId: 'c1', definitionId: 'sha', suit: 'heart', rank: 7 } }, { card: null }],
  outcome: { tone: 'good', symbol: '🔥', headline: { key: 'ui.confirm' }, text: { key: 'ui.cancel' }, hp: { seatId: 'seat-1' } },
  ...over,
});

function render(c: ResolutionNoticeContent) {
  const fixture = TestBed.createComponent(ResolutionNotice);
  fixture.componentRef.setInput('content', c);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ResolutionNotice', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the title, a portrait and name per seat, a line per step, and the cards', () => {
    const { el } = render(content());
    expect(el.querySelector('.title')!.textContent).toBe('Resolution');
    expect(el.querySelectorAll('app-seat-portrait').length).toBe(2);
    expect([...el.querySelectorAll('.actor .name')].map((n) => n.textContent)).toEqual(['Hing', 'Seat 1']);
    expect([...el.querySelectorAll('.steps li')].map((n) => n.textContent!.trim())).toEqual(['Confirm', 'Cancel']);
    expect(el.querySelectorAll('.cards app-playing-card').length).toBe(1);
    expect(el.querySelectorAll('.cards .card-back').length).toBe(1);
  });

  it('colours the outcome band by tone and shows HP hearts for the seat whose HP changed', () => {
    const { el } = render(content());
    expect(el.querySelector('.outcome')!.getAttribute('data-tone')).toBe('good');
    expect(el.querySelector('.outcome .headline')!.textContent).toBe('Confirm');
    expect(el.querySelector('.hp')!.textContent).toContain('Seat 1');
    expect(el.querySelectorAll('.hp .heart').length).toBe(4);
    expect(el.querySelectorAll('.hp .heart.lost').length).toBe(2);
  });

  it('has no HP when none changed, and no steps or cards when there are none', () => {
    const { el } = render(content({ steps: [], cards: [], outcome: { tone: 'neutral', symbol: '?', headline: { key: 'ui.confirm' }, text: { key: 'ui.cancel' } } }));
    expect(el.querySelector('.hp')).toBeNull();
    expect(el.querySelector('.steps')).toBeNull();
    expect(el.querySelector('.cards')).toBeNull();
  });

  it('takes the colour of the source seat’s force', () => {
    expect(render(content()).el.querySelector('.notice')!.getAttribute('data-force')).toBe('Wu');
  });

  it('fades on its own after NOTICE_MS and asks for nothing', () => {
    const { fixture, el } = render(content());
    const faded = jest.fn();
    fixture.componentInstance.faded.subscribe(faded);
    jest.advanceTimersByTime(NOTICE_MS - 1);
    expect(faded).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(faded).toHaveBeenCalledTimes(1);
    expect(el.querySelector('button')).toBeNull();
  });
});
