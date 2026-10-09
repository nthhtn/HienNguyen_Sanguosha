import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { GameService } from './game.service';

describe('/play', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('goes to Setup when no game is in progress', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('Play Game resumes a game in progress (Review Focus 1)', async () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    const stateBefore = gameService.state();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/wiki/tools');
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/game');
    expect(gameService.state()).toBe(stateBefore);
  });

  it('goes to Setup once the game has ended', async () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    (gameService as unknown as { _state: { set(v: unknown): void } })._state.set({
      ...gameService.state()!,
      result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });
});
