import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameService } from '../game.service';
import { PlaybackSpeed } from '../playback-speed.service';
import { GameBoard } from './game-board';

function resizeTo(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') {
    gameService.submit(gameService.legalActions()[0]);
  }
  if (gameService.state()!.turn.startWindow) {
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'ConfirmRevealsAction')!);
  }
}

describe('GameBoard layouts', () => {
  let gameService: GameService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    TestBed.inject(PlaybackSpeed).speed.set('instant');
  });

  afterEach(() => resizeTo(1024, 768));

  function runningBoard() {
    gameService.startGame(3, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('on a phone, in landscape', () => {
    beforeEach(() => resizeTo(852, 393));

    it('swaps the two history tiles for a History button', () => {
      const { el } = runningBoard();
      expect(el.querySelector('app-action-history')).toBeNull();
      expect(el.querySelector('app-discard-pile')).toBeNull();
      expect(el.querySelector('button.panel-toggle')!.getAttribute('aria-label')).toBe('History');
      expect(el.querySelector('app-board-panel')).toBeNull();
    });

    it('slides the panel over the board, and closes it on the backdrop, on Escape and on the button', () => {
      const { fixture, el } = runningBoard();
      const toggle = el.querySelector('button.panel-toggle') as HTMLButtonElement;
      toggle.click();
      fixture.detectChanges();
      expect(el.querySelector('app-board-panel')).not.toBeNull();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      (el.querySelector('.panel-scrim') as HTMLElement).click();
      fixture.detectChanges();
      expect(el.querySelector('app-board-panel')).toBeNull();

      toggle.click();
      fixture.detectChanges();
      el.querySelector('aside.panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(el.querySelector('app-board-panel')).toBeNull();

      toggle.click();
      fixture.detectChanges();
      toggle.click();
      fixture.detectChanges();
      expect(el.querySelector('app-board-panel')).toBeNull();
    });

    it('does not show the rotate prompt', () => {
      expect(runningBoard().el.querySelector('app-rotate-prompt')).toBeNull();
    });
  });

  describe('on a medium screen (900 to 1279 px wide)', () => {
    beforeEach(() => resizeTo(1133, 744));

    it('collapses the two history tiles into the History button, so the hand keeps the width', () => {
      const { fixture, el } = runningBoard();
      expect(el.querySelector('app-action-history')).toBeNull();
      expect(el.querySelector('app-discard-pile')).toBeNull();
      const toggle = el.querySelector('button.panel-toggle') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-label')).toBe('History');
      toggle.click();
      fixture.detectChanges();
      expect(el.querySelector('app-board-panel')).not.toBeNull();
    });

    it('puts your seat at the foot of the table, outside the bottom box that holds the hand', () => {
      const { el } = runningBoard();
      expect(el.querySelector('app-round-table .viewer .your-seat app-seat-tile')).not.toBeNull();
      expect(el.querySelectorAll('.your-seat')).toHaveLength(1);
      expect(el.querySelector('.your-hand .your-seat')).toBeNull();
      expect(el.querySelector('.your-hand button.panel-toggle')).not.toBeNull();
    });

    it('does not ask for a rotation, even in portrait', () => {
      resizeTo(1000, 1200);
      expect(runningBoard().el.querySelector('app-rotate-prompt')).toBeNull();
    });
  });

  describe('on a large screen (1280 px wide and up)', () => {
    beforeEach(() => resizeTo(1366, 768));

    it('keeps the two tiles, with no History button and no panel', () => {
      const { el } = runningBoard();
      expect(el.querySelector('app-action-history')).not.toBeNull();
      expect(el.querySelector('app-discard-pile')).not.toBeNull();
      expect(el.querySelector('button.panel-toggle')).toBeNull();
      expect(el.querySelector('app-board-panel')).toBeNull();
    });

    it('does not ask for a rotation, even in portrait', () => {
      resizeTo(1000, 1200);
      expect(runningBoard().el.querySelector('app-rotate-prompt')).toBeNull();
    });
  });

  describe('on a phone, in portrait', () => {
    beforeEach(() => resizeTo(390, 844));

    it('asks to rotate, and leaves the board in place underneath', () => {
      const { el } = runningBoard();
      const prompt = el.querySelector('app-rotate-prompt')!;
      expect(prompt.textContent).toContain('Rotate Your Device');
      expect(prompt.textContent).toContain('The Guozhan board needs a landscape screen. Turn your phone sideways to keep playing.');
      expect(el.querySelector('app-round-table')).not.toBeNull();
      expect(el.querySelector('.your-hand app-hand-view')).not.toBeNull();
    });

    it('does not ask while there is no game', () => {
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('app-rotate-prompt')).toBeNull();
    });

    it('does not ask during General selection', () => {
      gameService.startGame(3, 1);
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('app-rotate-prompt')).toBeNull();
    });
  });
});
