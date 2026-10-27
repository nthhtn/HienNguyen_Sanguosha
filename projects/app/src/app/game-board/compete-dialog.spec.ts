import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardInstance } from 'engine';
import { AUTO_CLOSE_SECONDS, CompeteDialog } from './compete-dialog';
import { CompeteResult } from './compete-result';

const nine: CardInstance = { instanceId: 'c9', definitionId: 'sha', suit: 'spade', rank: 9 };
const seven: CardInstance = { instanceId: 'c7', definitionId: 'shan', suit: 'heart', rank: 7 };
const result = (over: Partial<CompeteResult> = {}): CompeteResult => ({
  id: 'compete-3', abilityId: 'heavens-justice', abilityName: "Heaven's Justice", skillText: 'Compete with a seat.',
  generalId: 'taishi-ci', generalName: 'Taishi Ci', force: 'Wu',
  user: { seatId: 'seat-0', name: 'Hing', generalId: 'taishi-ci', force: 'Wu', card: nine },
  target: { seatId: 'seat-1', name: 'Seat 1', generalId: null, force: 'Shu', card: seven },
  won: true, tie: false, winnerName: 'Hing', outcome: 'Hing can play one more Slash this turn',
  comparison: { winnerRank: '9', loserRank: '7', tie: false },
  ...over,
});

function render(data: CompeteResult) {
  const close = jest.fn();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(CompeteDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const at = (ms: number) => {
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  return { fixture, el, close, at };
}
const count = (el: HTMLElement, selector: string) => el.querySelectorAll(selector).length;

describe('CompeteDialog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  });

  it('names the source: the General and its skill, with the skill’s text', () => {
    const { el } = render(result());
    const source = el.querySelector('.source')!.textContent!;
    expect(source).toContain('Taishi Ci');
    expect(source).toContain("Heaven's Justice");
    expect(source).toContain('Compete with a seat.');
  });

  it('shows both players, each in their own Force, with their cards', () => {
    const { el } = render(result());
    const sides = [...el.querySelectorAll('.side')];
    expect(sides).toHaveLength(2);
    expect(sides[0].textContent).toContain('Hing');
    expect(sides[1].textContent).toContain('Seat 1');
    expect(sides.map((s) => s.getAttribute('data-force'))).toEqual(['Wu', 'Shu']);
    expect(sides.map((s) => s.querySelector('app-playing-card')!.textContent)).toEqual([expect.stringContaining('9 ♠'), expect.stringContaining('7 ♥')]);
  });

  it('plays the beats in order: players and VS, cards down, cards turned together, winner lit, outcome', () => {
    const { el, at } = render(result());
    at(0);
    expect(count(el, '.side.in')).toBe(2);
    expect(count(el, '.vs.in')).toBe(1);
    expect(count(el, '.pc.in')).toBe(0);
    at(800);
    expect(count(el, '.pc.in')).toBe(2);
    expect(count(el, '.pc.up')).toBe(0);
    at(700);
    expect(count(el, '.pc.up')).toBe(2);
    expect(count(el, '.side.win')).toBe(0);
    at(1000);
    expect(count(el, '.side.win')).toBe(1);
    expect(count(el, '.side.lose')).toBe(1);
    expect(count(el, '.outcome.in')).toBe(0);
    at(900);
    expect(count(el, '.outcome.in')).toBe(1);
  });

  it('lights the winner and dims the loser, and says why in one line', () => {
    const { el, at } = render(result());
    at(2500);
    const sides = [...el.querySelectorAll('.side')];
    expect(sides[0].classList.contains('win')).toBe(true);
    expect(sides[0].textContent).toContain('Winner');
    expect(sides[1].classList.contains('lose')).toBe(true);
    expect(el.querySelector('.cmp')!.textContent).toContain('9 beats 7');
  });

  it('lights the challenged player on a tie and says a tie counts as a loss for the challenger', () => {
    const { el, at } = render(result({ won: false, tie: true, winnerName: 'Seat 1', comparison: { winnerRank: '9', loserRank: '9', tie: true } }));
    at(2500);
    const sides = [...el.querySelectorAll('.side')];
    expect(sides[1].classList.contains('win')).toBe(true);
    expect(el.querySelector('.cmp')!.textContent).toContain('9 ties 9');
    expect(el.querySelector('.cmp')!.textContent).toContain('counts as a loss for Hing');
  });

  it('states the result in words for screen readers, and the outcome once it shows', () => {
    const { el, at } = render(result());
    expect(el.querySelector('.result')!.textContent).toContain('Hing won');
    expect(el.querySelector('.result')!.textContent).toContain('9 ♠ against 7 ♥');
    at(3400);
    expect(el.querySelector('.outcome')!.textContent).toContain('Hing can play one more Slash this turn');
  });

  it('shows no outcome block for a skill with no outcome text', () => {
    expect(render(result({ outcome: null })).el.querySelector('.outcome')).toBeNull();
  });

  it('keeps Continue locked until 4200 ms, then closes on it', () => {
    const { el, close, at } = render(result());
    const button = el.querySelector('button.continue') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    at(4199);
    expect(button.disabled).toBe(true);
    at(1);
    expect(button.disabled).toBe(false);
    button.click();
    expect(close).toHaveBeenCalled();
  });

  it('starts a 3 second countdown at unlock and closes itself when it ends', () => {
    expect(AUTO_CLOSE_SECONDS).toBe(3);
    const { el, close, at } = render(result());
    at(4200);
    expect(el.querySelector('.seconds')!.textContent).toContain('3s');
    at(2000);
    expect(close).not.toHaveBeenCalled();
    at(1000);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('shows the final state at once under reduced motion', () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
    const { fixture, el } = render(result());
    fixture.detectChanges();
    expect(count(el, '.pc.up')).toBe(2);
    expect(count(el, '.side.win')).toBe(1);
    expect((el.querySelector('button.continue') as HTMLButtonElement).disabled).toBe(false);
  });

  it('stops its timers when it is destroyed', () => {
    const { fixture } = render(result());
    fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
