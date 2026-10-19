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
  user: { seatId: 'seat-0', name: 'Hing', generalId: 'taishi-ci', card: nine },
  target: { seatId: 'seat-1', name: 'Seat 1', generalId: null, card: seven },
  won: true, tie: false, winnerName: 'Hing', outcome: 'Hing can play one more Slash this turn',
  ...over,
});

function render(data: CompeteResult) {
  const close = jest.fn();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(CompeteDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close };
}

describe('CompeteDialog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('names the source: the General and its skill, with the skill’s text', () => {
    const { el } = render(result());
    const source = el.querySelector('.source')!.textContent!;
    expect(source).toContain('Taishi Ci');
    expect(source).toContain("Heaven's Justice");
    expect(source).toContain('Compete with a seat.');
  });

  it('shows both players with their cards', () => {
    const { el } = render(result());
    const sides = [...el.querySelectorAll('.side')];
    expect(sides).toHaveLength(2);
    expect(sides[0].textContent).toContain('Hing');
    expect(sides[1].textContent).toContain('Seat 1');
    expect(sides.map((s) => s.querySelector('app-playing-card')!.textContent)).toEqual([expect.stringContaining('9 ♠'), expect.stringContaining('7 ♥')]);
  });

  it('marks the winner, states the result and the outcome', () => {
    const { el } = render(result());
    const sides = [...el.querySelectorAll('.side')];
    expect(sides[0].classList.contains('winner')).toBe(true);
    expect(sides[1].classList.contains('winner')).toBe(false);
    expect(el.querySelector('.result')!.textContent).toContain('Hing won');
    expect(el.querySelector('.result')!.textContent).toContain('9 ♠ against 7 ♥');
    expect(el.querySelector('.outcome')!.textContent).toContain('Hing can play one more Slash this turn');
  });

  it('says a tie counts as a loss for the challenger', () => {
    const { el } = render(result({ won: false, tie: true, winnerName: 'Seat 1' }));
    expect(el.querySelector('.result')!.textContent).toContain('Tied');
    expect(el.querySelector('.result')!.textContent).toContain('Seat 1 won');
  });

  it('shows no outcome block for a skill with no outcome text', () => {
    expect(render(result({ outcome: null })).el.querySelector('.outcome')).toBeNull();
  });

  it('Continue closes it', () => {
    const { el, close } = render(result());
    (el.querySelector('button.continue') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalled();
  });

  it('closes itself after the countdown', () => {
    const { fixture, el, close } = render(result());
    expect(el.querySelector('.seconds')!.textContent).toContain(`${AUTO_CLOSE_SECONDS}s`);
    jest.advanceTimersByTime((AUTO_CLOSE_SECONDS - 1) * 1000);
    fixture.detectChanges();
    expect(close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
