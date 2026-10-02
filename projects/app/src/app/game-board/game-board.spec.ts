import { ruleBasedPolicy } from 'bots';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { GameBoard } from './game-board';
import { GameService } from '../game.service';
import { GeneralSelection } from './general-selection';
import { HandView } from './hand-view';

function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') {
    gameService.submit(gameService.legalActions()[0]);
  }
}

describe('GameBoard', () => {
  let gameService: GameService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
  });

  it('shows a fallback message and a link back to /setup when no game is in progress', () => {
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No game in progress.');
    const link = el.querySelector('a[href="/setup"]');
    expect(link).not.toBeNull();
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
    expect(el.querySelector('app-game-over')).toBeNull();
  });

  it('shows the reveal gate for the active seat when no seat is revealed yet', () => {
    gameService.startGame(2, 1);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });

  it('shows the general selection view, not the action list, after reveal during GeneralSelection', () => {
    gameService.startGame(2, 1);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-general-selection')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
    expect(el.querySelectorAll('app-general-selection [data-general-id]')).toHaveLength(5);
  });

  it('tells the selection view which seat is choosing and who has already chosen', () => {
    gameService.startGame(3, 1);
    gameService.submit(gameService.legalActions()[0]);
    gameService.reveal('seat-1');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection h2')!.textContent).toContain('seat-1, choose your generals');
    const chips = [...el.querySelectorAll('app-general-selection .progress mat-chip')];
    expect(chips.map((c) => c.classList.contains('done'))).toEqual([true, false, false]);
  });

  it('submits the chosen generals and gates the next seat', () => {
    gameService.startGame(2, 1);
    gameService.reveal('seat-0');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const selection = fixture.debugElement.query(By.directive(GeneralSelection)).componentInstance as GeneralSelection;
    selection.chosen.emit(gameService.legalActions()[0] as import('engine').ChooseGeneralsAction);
    fixture.detectChanges();

    expect(gameService.state()!.seats[0].generals).not.toBeNull();
    expect(gameService.activeSeatId()).toBe('seat-1');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
  });

  it('shows the action list once every seat has chosen and the active seat is revealed', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection')).toBeNull();
    expect(el.querySelector('app-action-list')).not.toBeNull();
  });

  it('seats everyone at a round table from the viewer’s chair, with the viewer’s own hand below', () => {
    gameService.startGame(3, 1);
    finishSelection(gameService);
    const viewer = gameService.activeSeatId()!;
    gameService.reveal(viewer);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-round-table')).not.toBeNull();
    expect(el.querySelectorAll('app-round-table app-seat-tile')).toHaveLength(3);
    expect(el.querySelector(`app-round-table [data-seat-id="${viewer}"]`)!.textContent).toContain('(you)');
    const state = gameService.visibleState()!;
    const ownHand = state.zones.find((z) => z.id === state.seats.find((s) => s.id === viewer)!.hand.zoneId)!;
    expect(el.querySelectorAll('.your-hand app-hand-view .hand-card')).toHaveLength(ownHand.cards.length);
  });

  it('submits a card played from the hand and gates the next view', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    fixture.detectChanges();
    const cardPlay = gameService.legalActions().find((a) => a.kind === 'PlayCardAction')!;
    expect(cardPlay).toBeDefined();
    const hand = fixture.debugElement.query(By.directive(HandView)).componentInstance as HandView;
    hand.play.emit(cardPlay);
    fixture.detectChanges();

    expect(gameService.lastError()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
  });

  it('re-shows the reveal gate for the next seat after an action is submitted', () => {
    gameService.startGame(2, 1);
    const firstSeat = gameService.activeSeatId()!;
    gameService.reveal(firstSeat);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    gameService.submit(gameService.legalActions()[0]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });

  it('re-shows the reveal gate for the next seat after an in-game action, post-selection', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const endPhase = gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!;
    expect(endPhase).toBeDefined();
    gameService.submit(endPhase);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });

  it('shows a dismissible error banner when GameService reports an error', () => {
    gameService.startGame(2, 1);
    gameService.reveal(gameService.activeSeatId()!);
    gameService.submit({ kind: 'PassAction', seatId: gameService.activeSeatId()!, pendingResponseId: 'nope' });
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('.error-banner')!;
    expect(banner.textContent).toContain('not legal during general selection');
    const dismiss = banner.querySelector('button')!;
    expect(dismiss.classList).toContain('mat-mdc-button-base');
    dismiss.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.error-banner')).toBeNull();
  });

  it('shows GameOver instead of the action list once the game has a result', () => {
    gameService.startGame(2, 1);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    // Play out actions via the real engine until the game ends. Repeatedly
    // ending phases alone never deals damage (only playing cards does), so
    // pick uniformly at random among every legal action each step — the same
    // action-selection strategy sim's random-legal-move bot uses, which this
    // engine's own property.spec.ts already proves reliably terminates
    // Kingdom War games across many seeds and seat counts.
    let guard = 0;
    while (!gameService.state()!.result && guard < 5000) {
      const seatId = gameService.activeSeatId()!;
      gameService.reveal(seatId);
      const actions = gameService.legalActions();
      expect(actions.length).toBeGreaterThan(0);
      const chosen = actions[Math.floor(Math.random() * actions.length)];
      gameService.submit(chosen);
      guard++;
    }
    expect(gameService.state()!.result).not.toBeNull();

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-over')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });
});

describe('GameBoard in vs-bots mode', () => {
  let gameService: GameService;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    gameService.botDelayMs = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function flushBots(): void {
    for (let guard = 0; gameService.botThinkingSeatId() && guard < 50000; guard++) jest.runOnlyPendingTimers();
  }

  it('shows the human’s general selection straight away, with no reveal gate', () => {
    gameService.startGame(3, 1, 'vs-bots');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-general-selection')).not.toBeNull();
  });

  it('shows a waiting card while the bots choose their generals', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection')).toBeNull();
    expect(el.querySelector('.bots-choosing')!.textContent).toContain('Bots are choosing their generals');
  });

  it('keeps the table on seat-0 and shows the thinking bot during a bot turn', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    flushBots(); // through selection and any bot turns, to the human's first move
    const humanMove = gameService.legalActions().find((a) => a.kind === 'EndPhaseAction');
    expect(humanMove).toBeDefined();
    // Advance the human to the end of their turn, so a bot is next.
    for (let i = 0; i < 10 && !gameService.botThinkingSeatId() && !gameService.state()!.result; i++) {
      const legal = gameService.legalActions();
      gameService.submit(legal.find((a) => a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
    }
    expect(gameService.botThinkingSeatId()).not.toBeNull();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-round-table [data-seat-id="seat-0"]')!.textContent).toContain('(you)');
    expect(el.querySelector('app-round-table .thinking')!.textContent).toContain('is thinking');
    // Nothing is playable while a bot acts (Review Focus 4).
    const playButtons = [...el.querySelectorAll('app-hand-view button.play')] as HTMLButtonElement[];
    expect(playButtons.every((b) => b.disabled)).toBe(true);
  });

  it('shows whose turn and which phase above the table', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    flushBots();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('app-phase-indicator')!;
    expect(indicator.textContent!.replace(/\s+/g, ' ').trim()).toBe('seat-0 (you) – Play Phase');
  });

  it('offers a way out to a new game when a bot move fails', () => {
    jest.spyOn(ruleBasedPolicy, 'decide').mockImplementation(() => {
      throw new Error('bot exploded');
    });
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    jest.runOnlyPendingTimers();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const banner = (fixture.nativeElement as HTMLElement).querySelector('.error-banner')!;
    expect(banner.textContent).toContain('bot exploded');
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const newGame = [...banner.querySelectorAll('button')].find((b) => b.textContent!.includes('New game')) as HTMLButtonElement;
    newGame.click();
    expect(navigate).toHaveBeenCalledWith('/setup');
    jest.restoreAllMocks();
  });
});
