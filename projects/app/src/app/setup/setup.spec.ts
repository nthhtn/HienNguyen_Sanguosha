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
    fixture.componentInstance.seatCount.set(gameService.maxSeats + 1);
    fixture.componentInstance.startGame();
    expect(gameService.state()!.seats).toHaveLength(gameService.maxSeats);
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

    describe('deck', () => {
      const clickIdentity = (fixture: { detectChanges(): void }, el: HTMLElement) => {
        const radios = [...el.querySelectorAll('.deck mat-radio-button')];
        (radios.find((r) => r.textContent!.trim() === 'Identity')!.querySelector('input') as HTMLInputElement).click();
        fixture.detectChanges();
      };
      const pickSeats = (fixture: { detectChanges(): void }, el: HTMLElement, n: number) => {
        ([...el.querySelectorAll('.seats mat-button-toggle button')].find((b) => b.textContent!.trim() === String(n)) as HTMLButtonElement).click();
        fixture.detectChanges();
      };

      it('offers the deck at every seat count and in both modes', async () => {
        const { fixture, el } = await create();
        for (const n of [2, 4, 5]) {
          pickSeats(fixture, el, n);
          expect([...el.querySelectorAll('.deck mat-radio-button')].map((r) => r.textContent!.trim())).toEqual(['Kingdom Wars', 'Identity']);
        }
        fixture.componentInstance.mode.set('pass-and-play');
        fixture.detectChanges();
        expect(el.querySelectorAll('.deck mat-radio-button')).toHaveLength(2);
      });

      it('deals from Kingdom Wars by default, which needs no deck rule', async () => {
        const { fixture, el, gameService } = await create();
        pickSeats(fixture, el, 4);
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).toEqual({ judgmentNotice: true });
      });

      it('keeps the Kingdom Wars deck when Identity is clicked: it is disabled for now (deferred)', async () => {
        const { fixture, el, gameService } = await create();
        pickSeats(fixture, el, 4);
        clickIdentity(fixture, el);
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).toEqual({ judgmentNotice: true });
      });

      it('sends First Reveal Bonus at 5 seats, and no deck rule for Kingdom Wars', async () => {
        const { fixture, el, gameService } = await create();
        pickSeats(fixture, el, 5);
        clickIdentity(fixture, el);
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).toEqual({ firstRevealDraw: true, judgmentNotice: true });
      });
    });

    describe('first reveal bonus', () => {
      const pick = (fixture: { detectChanges(): void }, el: HTMLElement, n: number) => {
        ([...el.querySelectorAll('.seats mat-button-toggle button')].find((b) => b.textContent!.trim() === String(n)) as HTMLButtonElement).click();
        fixture.detectChanges();
      };

      it('shows the checkbox, checked, only from 5 seats', async () => {
        const { fixture, el } = await create();
        pick(fixture, el, 4);
        expect(el.querySelector('.first-reveal')).toBeNull();
        pick(fixture, el, 5);
        expect(el.querySelector('.first-reveal')!.textContent).toContain('First Reveal Bonus');
        expect(el.querySelector('.first-reveal input')).toHaveProperty('checked', true);
      });

      it('starts a game with the rule on by default at 5 seats', async () => {
        const { fixture, el, gameService } = await create();
        pick(fixture, el, 5);
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).toEqual({ firstRevealDraw: true, judgmentNotice: true });
      });

      it('starts a game with the rule off when unchecked', async () => {
        const { fixture, el, gameService } = await create();
        pick(fixture, el, 5);
        (el.querySelector('.first-reveal input') as HTMLInputElement).click();
        fixture.detectChanges();
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).toEqual({ firstRevealDraw: false, judgmentNotice: true });
      });

      it('sets no rule below 5 seats', async () => {
        const { fixture, el, gameService } = await create();
        pick(fixture, el, 4);
        (el.querySelector('button.start') as HTMLButtonElement).click();
        expect(gameService.state()!.rules).not.toHaveProperty('firstRevealDraw');
      });
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
        b.textContent!.includes('Pass and Play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      expect(el.querySelector('.mode-hint')!.textContent).toContain('Passing it between turns');
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.mode()).toBe('pass-and-play');
      expect(gameService.state()!.players.every((p) => p.kind === 'human')).toBe(true);
    });
    it('asks for your name against bots, and names the bots by seat', async () => {
      const { fixture, el, gameService } = await create();
      const fields = el.querySelectorAll('input.name');
      expect(fields).toHaveLength(1);
      expect(el.querySelector('.names mat-label')!.textContent).toContain('Your Name');
      const yours = fields[0] as HTMLInputElement;
      yours.value = '  Hing ';
      yours.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.state()!.players.map((p) => p.name)).toEqual(['Hing', 'Seat 1', 'Seat 2', 'Seat 3']);
    });

    it('asks for every seat’s name in pass-and-play, and a blank name stays "Seat N"', async () => {
      const { fixture, el, gameService } = await create();
      const passAndPlay = [...el.querySelectorAll('.mode mat-button-toggle button')].find((b) =>
        b.textContent!.includes('Pass and Play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      const fields = [...el.querySelectorAll('input.name')] as HTMLInputElement[];
      expect(fields).toHaveLength(4);
      expect(fields.map((f) => f.placeholder)).toEqual(['Seat 0', 'Seat 1', 'Seat 2', 'Seat 3']);
      fields[0].value = 'Ann';
      fields[0].dispatchEvent(new Event('input'));
      fields[2].value = 'Bo';
      fields[2].dispatchEvent(new Event('input'));
      fixture.detectChanges();
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.state()!.players.map((p) => p.name)).toEqual(['Ann', 'Seat 1', 'Bo', 'Seat 3']);
    });

    it('describes the chosen mode in the card header and how-it-works lines', async () => {
      const { fixture, el } = await create();
      expect(el.querySelector('mat-card-subtitle')!.textContent).toContain('you against computer opponents');
      expect(el.querySelector('.how')!.textContent).not.toContain('Pass the device');
      const passAndPlay = [...el.querySelectorAll('.mode mat-button-toggle button')].find((b) =>
        b.textContent!.includes('Pass and Play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      expect(el.querySelector('mat-card-subtitle')!.textContent).toContain('pass-and-play on one device');
      expect(el.querySelector('.how')!.textContent).toContain('Pass the device');
    });
  });
});
