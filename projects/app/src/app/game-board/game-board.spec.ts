import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { GameBoard } from './game-board';
import { GameService } from '../game.service';
import { GeneralSelection } from './general-selection';

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
    expect(el.querySelectorAll('.your-hand app-card-art')).toHaveLength(ownHand.cards.length);
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('not legal during general selection');
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
