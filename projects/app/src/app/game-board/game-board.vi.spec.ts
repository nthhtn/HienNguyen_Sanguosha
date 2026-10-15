import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameService } from '../game.service';
import { I18n } from '../i18n/i18n.service';
import { MUSIC_PLAYER_FACTORY } from '../music.service';
import { GameBoard } from './game-board';

function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') gameService.submit(gameService.legalActions()[0]);
}

describe('GameBoard in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [
        provideRouter([{ path: 'setup', children: [] }]),
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
      ],
    }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => localStorage.clear());

  it('the action history panel reads the log in Vietnamese, so the translator reaches the history', () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const latest = (fixture.nativeElement as HTMLElement).querySelector('app-action-history .text')!.textContent!;
    expect(latest).toMatch(/rút \d+ lá bài|đã chọn Tướng của mình/);
    expect(latest).not.toMatch(/drew|chose/);
  });
});
