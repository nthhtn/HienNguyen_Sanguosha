import { TestBed } from '@angular/core/testing';
import { GameResult, Kingdom } from 'engine';
import { FinalSeatView } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { VictoryBoard } from './victory-board';

const seat = (n: number, kingdom: Kingdom, allegiance: FinalSeatView['allegiance'], main: string | null, deputy: string | null, eliminated = false): FinalSeatView => ({
  seatId: `seat-${n}`, kingdom, allegiance, mainGeneralId: main, deputyGeneralId: deputy, eliminated,
});
const result = (over: Partial<GameResult> = {}): GameResult => ({ endedAt: 1, winningSeatIds: [], losingSeatIds: [], ...over });
const NAMES: Record<string, string> = { 'seat-0': 'Hing', 'seat-1': 'Bot An', 'seat-2': 'Bot Binh', 'seat-3': 'Bot Chi' };
const nameOf = (id: string) => NAMES[id] ?? id;

// Wei wins: Hing and a fallen Bot An for Wei, a fallen Bot Binh for Shu.
const weiSeats = [
  seat(0, 'Wei', 'kingdom', 'cao-cao', 'xiahou-dun'),
  seat(1, 'Wei', 'kingdom', 'xiahou-dun', 'cao-cao', true),
  seat(2, 'Shu', 'kingdom', 'liu-bei', null, true),
];
const weiResult = result({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'], losingSeatIds: ['seat-2'] });

function render(seats: FinalSeatView[], res: GameResult, youSeatId: string | null = null) {
  const fixture = TestBed.createComponent(VictoryBoard);
  fixture.componentRef.setInput('seats', seats);
  fixture.componentRef.setInput('result', res);
  fixture.componentRef.setInput('youSeatId', youSeatId);
  fixture.componentRef.setInput('nameOf', nameOf);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function setReducedMotion(matches: boolean | undefined): void {
  if (matches === undefined) {
    delete (window as { matchMedia?: unknown }).matchMedia;
    return;
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({ matches: matches && query.includes('reduce'), media: query })),
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  setReducedMotion(undefined);
  jest.useRealTimers();
});

describe('VictoryBoard', () => {
  it('renders one column per group present, in order, with member names, General pairs and Survived or Fallen', () => {
    const { el } = render(weiSeats, weiResult);
    const cols = Array.from(el.querySelectorAll('section.col'));
    expect(cols.map((c) => c.getAttribute('data-f'))).toEqual(['Wei', 'Shu']);
    expect(text(cols[0].querySelector('.title'))).toBe('Wei');
    expect(text(cols[0].querySelector('.count'))).toBe('2 players');
    expect(text(cols[1].querySelector('.count'))).toBe('1 player');

    const rows = Array.from(cols[0].querySelectorAll('li.m'));
    expect(rows.map((r) => text(r.querySelector('.name')))).toEqual(['Hing', 'Bot An']);
    expect(text(rows[0].querySelector('.generals'))).toBe('Cao Cao · Xiahou Dun');
    expect(rows[0].classList).toContain('alive');
    expect(text(rows[0].querySelector('.state'))).toContain('Survived');
    expect(rows[1].classList).toContain('fallen');
    expect(text(rows[1].querySelector('.state'))).toContain('Fallen');
    // A missing Deputy General leaves only the Main General.
    expect(text(cols[1].querySelector('li.m .generals'))).toBe('Liu Bei');
    expect(el.querySelector('.cols')!.getAttribute('aria-label')).toBe('Final Standings');
  });

  it('lights only the winning column after the reveal and dims the rest', () => {
    jest.useFakeTimers();
    const { fixture, el } = render(weiSeats, weiResult);
    expect(el.querySelectorAll('.col.win').length).toBe(0);
    jest.advanceTimersByTime(3000);
    fixture.detectChanges();
    const win = el.querySelectorAll('.col.win');
    expect(win.length).toBe(1);
    expect(win[0].getAttribute('data-f')).toBe('Wei');
    expect(text(win[0].querySelector('.tag'))).toBe('Winners');
    expect(Array.from(el.querySelectorAll('.col:not(.win)')).every((c) => c.classList.contains('lose'))).toBe(true);
    expect(el.querySelector('.headline')!.getAttribute('data-force')).toBe('Wei');
    fixture.destroy();
  });

  it('a draw lights nothing and shows the draw headline', () => {
    jest.useFakeTimers();
    const seats = [seat(0, 'Wei', 'kingdom', 'cao-cao', null, true), seat(1, 'Shu', 'kingdom', 'liu-bei', null, true)];
    const { fixture, el } = render(seats, result({ losingSeatIds: ['seat-0', 'seat-1'] }));
    jest.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelectorAll('.col.win').length).toBe(0);
    expect(el.querySelectorAll('.col.lose').length).toBe(0);
    expect(text(el.querySelector('.headline'))).toBe('Draw — No survivors.');
    expect(el.querySelector('.headline')!.hasAttribute('data-force')).toBe(false);
    expect(text(el.querySelector('.sub'))).toBe('Everyone fell at the same time.');
    fixture.destroy();
  });

  it('each headline kind reads as the Global Constraints say', () => {
    const kingdom = render(weiSeats, weiResult).el;
    expect(text(kingdom.querySelector('.headline'))).toBe('Wei wins!');
    expect(text(kingdom.querySelector('.sub'))).toBe('Every survivor played for Wei.');
    expect(text(kingdom.querySelector('.eyebrow'))).toBe('Game Over');

    const ambitionist = render(
      [seat(0, 'Qun', 'ambitionist', 'cao-cao', null), seat(1, 'Wei', 'kingdom', 'xiahou-dun', null, true)],
      result({ winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] }),
    ).el;
    expect(text(ambitionist.querySelector('.headline'))).toBe('Hing wins as the Ambitionist!');
    expect(ambitionist.querySelector('.headline')!.getAttribute('data-force')).toBe('Ambitionist');
    expect(text(ambitionist.querySelector('.sub'))).toBe('The last survivor, playing alone.');

    const lone = render(
      [seat(0, 'Shu', null, 'liu-bei', null), seat(1, 'Wei', 'kingdom', 'cao-cao', null, true)],
      result({ winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] }),
    ).el;
    expect(text(lone.querySelector('.headline'))).toBe('Hing wins!');
    expect(text(lone.querySelector('.sub'))).toBe('The last survivor.');

    const draw = render([seat(0, 'Wei', 'kingdom', 'cao-cao', null, true)], result()).el;
    expect(text(draw.querySelector('.headline'))).toBe('Draw — No survivors.');
  });

  it("tags only the viewer's seat as You", () => {
    const { el } = render(weiSeats, weiResult, 'seat-1');
    const tagged = Array.from(el.querySelectorAll('li.m')).filter((r) => r.querySelector('.you'));
    expect(tagged.map((r) => text(r.querySelector('.name')))).toEqual(['Bot An']);
    expect(text(tagged[0].querySelector('.you'))).toBe('You');

    const none = render(weiSeats, weiResult, null).el;
    expect(none.querySelectorAll('.you').length).toBe(0);
  });

  it('uses the plural label for two or more losing Ambitionists', () => {
    const one = render(
      [seat(0, 'Wei', 'kingdom', 'cao-cao', null), seat(1, 'Qun', 'ambitionist', 'liu-bei', null, true)],
      result({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] }),
    ).el;
    expect(text(one.querySelector('.col[data-f="Ambitionist"] .title'))).toBe('Losing Ambitionist');

    const two = render(
      [seat(0, 'Wei', 'kingdom', 'cao-cao', null), seat(1, 'Qun', 'ambitionist', 'liu-bei', null, true), seat(2, 'Shu', 'ambitionist', 'xiahou-dun', null, true)],
      result({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1', 'seat-2'] }),
    ).el;
    expect(text(two.querySelector('.col[data-f="Ambitionist"] .title'))).toBe('Losing Ambitionists');
  });

  it('re-renders names and labels when the language changes', async () => {
    const { fixture, el } = render(weiSeats, weiResult);
    expect(text(el.querySelector('.headline'))).toBe('Wei wins!');
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(text(el.querySelector('.headline'))).toBe('Ngụy thắng!');
    expect(text(el.querySelector('section.col .title'))).toBe('Ngụy');
    expect(text(el.querySelector('li.m .generals'))).toBe('Tào Tháo · Hạ Hầu Đôn');
    fixture.destroy();
  });

  it('shows the end state at once under prefers-reduced-motion and leaves no timer running after destroy', () => {
    jest.useFakeTimers();
    setReducedMotion(true);
    const reduced = render(weiSeats, weiResult);
    expect(reduced.el.querySelectorAll('.col.win').length).toBe(1);
    expect(reduced.el.querySelectorAll('.col.lose').length).toBe(1);
    expect(reduced.el.querySelectorAll('.col.shown').length).toBe(2);
    expect(reduced.el.querySelector('.head.shown')).not.toBeNull();
    reduced.fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);

    // With motion, a board closed mid-reveal leaves nothing behind.
    setReducedMotion(false);
    const moving = render(weiSeats, weiResult);
    expect(moving.el.querySelectorAll('.col.win').length).toBe(0);
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    jest.advanceTimersByTime(600);
    moving.fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
