import { TestBed } from '@angular/core/testing';
import { GameResult } from 'engine';
import { GameOver } from './game-over';

describe('GameOver', () => {
  it('renders the winning kingdom and seat lists, and emits newGame on click', () => {
    const fixture = TestBed.createComponent(GameOver);
    const result: GameResult = {
      endedAt: 12,
      winningKingdom: 'Wei',
      winningSeatIds: ['seat-0', 'seat-2'],
      losingSeatIds: ['seat-1', 'seat-3'],
    };
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Wei');
    expect(text).toContain('seat-0');
    expect(text).toContain('seat-2');
    expect(text).toContain('seat-1');

    const newGameSpy = jest.fn();
    fixture.componentInstance.newGame.subscribe(newGameSpy);
    (fixture.nativeElement as HTMLElement).querySelector('button')!.dispatchEvent(new Event('click'));
    expect(newGameSpy).toHaveBeenCalled();
  });

  it('renders a draw when there is no winning kingdom', () => {
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', {
      endedAt: 20,
      winningSeatIds: [],
      losingSeatIds: ['seat-0', 'seat-1'],
    } satisfies GameResult);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Draw');
  });

  it('renders the winning seat(s) when there is a lone survivor with no shared kingdom', () => {
    // This is the case that actually occurs in real play: checkWinCondition's
    // alive.length === 1 branch sets winningSeatIds but never winningKingdom.
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', {
      endedAt: 30,
      winningSeatIds: ['seat-0'],
      losingSeatIds: ['seat-1', 'seat-2', 'seat-3'],
    } satisfies GameResult);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('seat-0 wins!');
    expect(text).not.toContain('Draw');
  });
});
