import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { Setup } from './setup';
import { GameService } from '../game.service';

describe('Setup', () => {
  it('starts a game with the chosen seat count and navigates to /game', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Setup);
    const component = fixture.componentInstance;
    const gameService = TestBed.inject(GameService);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl');

    component.seatCount.set(5);
    component.startGame();

    expect(gameService.state()!.seats).toHaveLength(5);
    expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining('/game'));
  });

  it('clamps a zeroed/cleared seat count into [2, 8] instead of sending 0', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Setup);
    const component = fixture.componentInstance;
    const gameService = TestBed.inject(GameService);

    // Simulates clearing the seat-count input: `+'' === 0`.
    component.seatCount.set(0);
    component.startGame();

    const seatCount = gameService.state()!.seats.length;
    expect(seatCount).toBeGreaterThanOrEqual(2);
    expect(seatCount).toBeLessThanOrEqual(8);
  });

  it('passes an explicit seed through to GameService when provided', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Setup);
    const component = fixture.componentInstance;
    const gameService = TestBed.inject(GameService);

    component.seatCount.set(3);
    component.seed.set(99);
    component.startGame();
    const first = gameService.state();

    component.startGame();
    const second = gameService.state();

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });
});
