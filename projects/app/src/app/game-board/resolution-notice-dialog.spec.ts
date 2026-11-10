import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { GameState } from 'engine';
import type { ResolutionNoticeContent } from 'content';
import { NOTICE_SECONDS, noticeForce, ResolutionNoticeDialog } from './resolution-notice-dialog';

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
  const close = jest.fn();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { content: c, state } }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(ResolutionNoticeDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close };
}

describe('ResolutionNoticeDialog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('names its source like the Compete and Judgment popups do: the card, or the General and its skill', () => {
    expect(render(content()).el.querySelector('.source .who')!.textContent!.trim()).toBe('Blaze');
    TestBed.resetTestingModule();
    const skill = render(content({ source: { kind: 'skill', id: 'resurgence', seatId: 'seat-0' } }));
    expect(skill.el.querySelector('.source .who')!.textContent).toContain('Zhou Yu');
    expect(skill.el.querySelector('.source .who')!.textContent).toContain('Resurgence');
  });

  it('shows the title, a portrait and name per seat, a line per step, and the cards', () => {
    const { el } = render(content());
    expect(el.querySelector('h2')!.textContent).toBe('Resolution');
    expect(el.querySelectorAll('.side app-seat-portrait').length).toBe(2);
    expect([...el.querySelectorAll('.side .name')].map((n) => n.textContent)).toEqual(['Hing', 'Seat 1']);
    expect([...el.querySelectorAll('.steps li')].map((n) => n.textContent!.trim())).toEqual(['Confirm', 'Cancel']);
    expect(el.querySelectorAll('.cards app-playing-card').length).toBe(1);
    expect(el.querySelectorAll('.cards .card-back').length).toBe(1);
  });

  it('lists a card per seat in a row, with the seat’s name and revealed Generals under each, and no separate seat row', () => {
    const peach = { instanceId: 'p', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
    const sha = { instanceId: 's', definitionId: 'sha', suit: 'spade' as const, rank: 9 };
    const { el } = render(content({ steps: [], cards: [], seatCards: [{ seatId: 'seat-0', card: peach }, { seatId: 'seat-1', card: sha }] }));
    const items = [...el.querySelectorAll('.seat-cards .seat-card')];
    expect(items.map((i) => i.querySelector(':scope > .name')!.textContent)).toEqual(['Hing', 'Seat 1']);
    expect(items.map((i) => i.querySelector('app-playing-card') !== null)).toEqual([true, true]);
    expect(items[0].querySelector('.generals')!.textContent!.trim()).toBe('Zhou Yu');
    expect(items[0].getAttribute('data-force')).toBe('Wu');
    expect(items[1].querySelector('.generals')!.textContent!.trim()).toBe('Cao Cao');
    expect(el.querySelector('.actors')).toBeNull();
  });

  it('shows no Generals line for a seat that has none face up', () => {
    const hidden = { ...state, seats: [{ ...seat('seat-0', 'hidden', 'hidden'), generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } } }] } as unknown as GameState;
    const close = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { content: content({ seatCards: [{ seatId: 'seat-0', card: { instanceId: 'p', definitionId: 'peach', suit: 'heart', rank: 3 } }] }), state: hidden } }, { provide: MatDialogRef, useValue: { close } }] });
    const fixture = TestBed.createComponent(ResolutionNoticeDialog);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.seat-card .generals')).toBeNull();
  });

  it('colours the outcome by tone and shows HP hearts for the seat whose HP changed', () => {
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

  it('turns seat ids and card ids in a line’s params into the seat’s name and the card’s name', () => {
    const { el } = render(content({ outcome: { tone: 'good', symbol: '🔥', headline: { key: 'notice.blaze.hit', params: { card: 'blaze' } }, text: { key: 'notice.blaze.hitText', params: { targetSeat: 'seat-0', amount: 1 } } } }));
    expect(el.querySelector('.headline')!.textContent).toBe('Blaze hit');
    expect(el.querySelector('.text')!.textContent).toBe('Hing took 1 fire damage');
  });

  it('is themed by the force of the source seat', () => {
    expect(noticeForce(content(), state)).toBe('Wu');
    expect(noticeForce(content({ source: { kind: 'skill', id: 'resurgence', seatId: 'seat-1' } }), state)).toBe('Wei');
  });

  it('counts down 5 seconds by default, with no button, then closes itself once', () => {
    expect(NOTICE_SECONDS).toBe(5);
    const { fixture, el, close } = render(content());
    expect(el.querySelector('.timer .seconds')!.textContent).toBe('5s');
    jest.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(el.querySelector('.timer .seconds')!.textContent).toBe('1s');
    expect(close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(close).toHaveBeenCalledTimes(1);
    expect(el.querySelector('button')).toBeNull();
  });

  it('lasts as long as the notice asks for, when it asks for longer', () => {
    const { fixture, el, close } = render(content({ seconds: 10 }));
    expect(el.querySelector('.timer .seconds')!.textContent).toBe('10s');
    expect(el.querySelector('.timer .fill')!.getAttribute('style')).toContain('100%');
    jest.advanceTimersByTime(9000);
    fixture.detectChanges();
    expect(el.querySelector('.timer .seconds')!.textContent).toBe('1s');
    expect(close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
