import { TestBed } from '@angular/core/testing';
import type { LastGame } from 'protocol';
import { OnlineResult } from './online-result';
import { LAST_GAME } from './testing';

describe('OnlineResult', () => {
  function render(ending: LastGame, solo = false, youPlayerId: string | null = null) {
    TestBed.configureTestingModule({ imports: [OnlineResult] });
    const fixture = TestBed.createComponent(OnlineResult);
    fixture.componentRef.setInput('ending', ending);
    fixture.componentRef.setInput('solo', solo);
    fixture.componentRef.setInput('youPlayerId', youPlayerId);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim();
  const texts = (el: HTMLElement, selector: string) => [...el.querySelectorAll(selector)].map((e) => e.textContent?.trim());

  it('renders the victory board for a finished game and drops the winners and losers lines', () => {
    const el = render(LAST_GAME);
    expect(text(el, 'mat-card-title')).toBe('Game Over');
    expect(el.querySelector('app-victory-board')).not.toBeNull();
    expect(text(el, 'app-victory-board .headline')).toBe('Wei wins!');
    expect(texts(el, 'app-victory-board .col .name')).toEqual(['Ann', 'Bo']);
    expect(el.querySelector('.winners')).toBeNull();
    expect(el.querySelector('.losers')).toBeNull();
    expect(text(el, 'button.back-to-lobby')).toBe('Back to Lobby');
  });

  it("tags the viewer's seat as You from youPlayerId", () => {
    const el = render(LAST_GAME, false, 'p-bo');
    const you = [...el.querySelectorAll('app-victory-board .m')].filter((m) => m.querySelector('.you'));
    expect(you.map((m) => m.querySelector('.name')?.textContent?.trim())).toEqual(['Bo']);
    TestBed.resetTestingModule();
    expect(render(LAST_GAME).querySelector('app-victory-board .you')).toBeNull();
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
