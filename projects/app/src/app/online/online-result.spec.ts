import { TestBed } from '@angular/core/testing';
import type { LastGame } from 'protocol';
import { OnlineResult } from './online-result';
import { LAST_GAME } from './testing';

describe('OnlineResult', () => {
  function render(ending: LastGame, solo = false) {
    TestBed.configureTestingModule({ imports: [OnlineResult] });
    const fixture = TestBed.createComponent(OnlineResult);
    fixture.componentRef.setInput('ending', ending);
    fixture.componentRef.setInput('solo', solo);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim();

  it('names the winners and losers of a finished game', () => {
    const el = render(LAST_GAME);
    expect(text(el, 'mat-card-title')).toBe('Game Over');
    expect(text(el, '.headline')).toBe('Ann wins!');
    expect(text(el, '.winners')).toBe('Winners: Ann');
    expect(text(el, '.losers')).toBe('Losers: Bo');
    expect(text(el, 'button.back-to-lobby')).toBe('Back to Lobby');
  });

  it('names a winning Force', () => {
    const el = render({ ...LAST_GAME, result: { ...LAST_GAME.result!, winningKingdom: 'Wei' } });
    expect(text(el, '.headline')).toBe('Wei wins!');
  });

  it("says why a game stopped when it didn't finish", () => {
    expect(text(render({ ...LAST_GAME, outcome: 'broken', result: null }), '.stopped')).toBe('This game hit an error and has stopped');
    TestBed.resetTestingModule();
    const el = render({ ...LAST_GAME, outcome: 'outdated', result: null });
    expect(text(el, 'mat-card-title')).toBe('Game Stopped');
    expect(text(el, '.stopped')).toBe("This game can't continue after an update");
  });

  it('offers Play Again and Back to Rooms after a solo game', () => {
    const el = render(LAST_GAME, true);
    expect(el.querySelector('button.back-to-lobby')).toBeNull();
    expect(text(el, 'button.play-again')).toContain('Play Again');
    expect(text(el, 'button.back-to-rooms')).toBe('Back to Rooms');
  });
});
