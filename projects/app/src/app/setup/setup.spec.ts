import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { Setup } from './setup';
import { GameService } from '../game.service';

describe('Setup', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
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

  it('clamps a zeroed/cleared seat count into [2, maxSeats] instead of sending 0', async () => {
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
    expect(seatCount).toBeLessThanOrEqual(gameService.maxSeats);
  });

  it('clamps a seat count above the mode’s cap down to maxSeats', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Setup);
    const gameService = TestBed.inject(GameService);
    fixture.componentInstance.seatCount.set(8);
    fixture.componentInstance.startGame();
    expect(gameService.state()!.seats).toHaveLength(gameService.maxSeats);
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

  describe('home screen controls', () => {
    async function create() {
      await TestBed.configureTestingModule({
        imports: [Setup],
        providers: [provideRouter([{ path: 'game', children: [] }])],
      }).compileComponents();
      const fixture = TestBed.createComponent(Setup);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement, gameService: TestBed.inject(GameService) };
    }

    it('offers one seat toggle per legal table size, from 2 up to maxSeats', async () => {
      const { el, gameService } = await create();
      const labels = [...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent!.trim());
      expect(labels).toEqual(Array.from({ length: gameService.maxSeats - 1 }, (_, i) => String(i + 2)));
    });

    it('starts a game with the seat count picked on the toggles', async () => {
      const { fixture, el, gameService } = await create();
      const three = [...el.querySelectorAll('mat-button-toggle button')].find((b) => b.textContent!.trim() === '3') as HTMLButtonElement;
      three.click();
      fixture.detectChanges();
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.state()!.seats).toHaveLength(3);
    });

    it('reads an optional seed from the seed field', async () => {
      const { fixture, el } = await create();
      const input = el.querySelector('input.seed') as HTMLInputElement;
      input.value = '42';
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.seed()).toBe(42);
      input.value = '';
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.seed()).toBeUndefined();
    });
    it('defaults to playing against bots', async () => {
      const { el, gameService } = await create();
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.mode()).toBe('vs-bots');
      expect(gameService.state()!.players[0].kind).toBe('human');
      expect(gameService.state()!.players.slice(1).every((p) => p.kind === 'bot')).toBe(true);
    });

    it('starts a pass-and-play game when that mode is picked (Review Focus 5)', async () => {
      const { fixture, el, gameService } = await create();
      const passAndPlay = [...el.querySelectorAll('.mode mat-button-toggle button')].find((b) =>
        b.textContent!.includes('Pass-and-play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      expect(el.querySelector('.mode-hint')!.textContent).toContain('passing it between turns');
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.mode()).toBe('pass-and-play');
      expect(gameService.state()!.players.every((p) => p.kind === 'human')).toBe(true);
    });
    it('describes the chosen mode in the card header and how-it-works lines', async () => {
      const { fixture, el } = await create();
      expect(el.querySelector('mat-card-subtitle')!.textContent).toContain('you against computer opponents');
      expect(el.querySelector('.how')!.textContent).not.toContain('Pass the device');
      const passAndPlay = [...el.querySelectorAll('.mode mat-button-toggle button')].find((b) =>
        b.textContent!.includes('Pass-and-play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      expect(el.querySelector('mat-card-subtitle')!.textContent).toContain('pass-and-play on one device');
      expect(el.querySelector('.how')!.textContent).toContain('Pass the device');
    });
  });
});
