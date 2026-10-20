import { pickRandomAction, ruleBasedPolicy } from 'bots';
import { Router } from '@angular/router';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogState } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { I18n } from '../i18n/i18n.service';
import { DecisionDock } from './decision-dock';
import { GameBoard } from './game-board';
import { BattlefieldBackgrounds } from '../battlefield-background.service';
import { GameService } from '../game.service';
import { Action, GameState, cardsOverHandLimit, createRng } from 'engine';
import { GeneralSelection } from './general-selection';
import { HandView } from './hand-view';
import { cardDefinitionId } from '../labels';
import { EFFECT_URLS, MUSIC_PLAYER_FACTORY } from '../music.service';

@Component({ template: 'info' })
class InfoProbe {}

// Selection through to the first Play phase: a human seat with a hidden General
// first rests in its Start window, which Continue (EndPhaseAction) closes.
function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') {
    gameService.submit(gameService.legalActions()[0]);
  }
  if (gameService.state()!.turn.startWindow) {
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
  }
}


// Whether the state waits on the target's own answer to a damage card (a Slash's
// Dodge window or a Duel's), not on a Wuxie question or an ability's ask.
function waitsOnDamageAnswer(state: GameState): boolean {
  const reason = state.pendingResponse?.reason;
  return !!state.pendingResponse && !state.pendingChoice && (!reason || reason.kind === 'card-effect');
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

  it('offers the Battlefield menu only while the battlefield is on screen', () => {
    const backgrounds = TestBed.inject(BattlefieldBackgrounds);
    const idle = TestBed.createComponent(GameBoard);
    idle.detectChanges();
    expect(backgrounds.available()).toBe(false);
    idle.destroy();

    gameService.startGame(3, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-round-table')).not.toBeNull();
    expect(backgrounds.available()).toBe(true);
    fixture.destroy();
    expect(backgrounds.available()).toBe(false);
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

  it('tells the selection view which seat is choosing', () => {
    gameService.startGame(3, 1);
    gameService.submit(gameService.legalActions()[0]);
    gameService.reveal('seat-1');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection h2')!.textContent).toContain('Seat 1, Choose your Generals');
    expect(el.querySelector('app-general-selection .progress')).toBeNull();
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

  it('shows Continue and the enabled Reveal buttons for a viewer in their Start window', () => {
    gameService.startGame(2, 1);
    while (gameService.state()!.phase === 'GeneralSelection') gameService.submit(gameService.legalActions()[0]);
    expect(gameService.state()!.turn.startWindow).toBe(true);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll('app-action-list button')].map((b) => b.textContent!.trim());
    expect(buttons).toContain('Continue');
    expect(buttons).not.toContain('End Phase');
    const reveals = [...el.querySelectorAll('app-seat-avatar button.reveal')] as HTMLButtonElement[];
    expect(reveals).toHaveLength(2);
    expect(reveals.every((b) => !b.disabled)).toBe(true);
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
    expect(el.querySelectorAll('app-round-table app-seat-tile')).toHaveLength(2);
    expect(el.querySelector(`app-round-table [data-seat-id="${viewer}"]`)).toBeNull();
    expect(el.querySelector('.your-seat app-seat-tile')!.textContent).toContain('(you)');
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

  it('keeps the same seat’s view through a discard in pass-and-play (Review Focus 3)', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
    // 4 dealt + 2 drawn = 6 cards against at most 4 HP: at least 2 over the limit.
    expect(gameService.state()!.phase).toBe('Discard');
    expect(gameService.activeSeatId()).toBe(seatId);

    gameService.reveal(seatId);
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'DiscardCardAction')!);
    expect(gameService.lastError()).toBeNull();
    // Still at least 1 over: the same seat discards again, behind the usual gate.
    expect(gameService.state()!.phase).toBe('Discard');
    expect(gameService.activeSeatId()).toBe(seatId);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
  });

  it('opens the Discard dialog in the viewer’s Discard phase, and Discard ends the phase in one step', async () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
    gameService.reveal(seatId);
    const over = cardsOverHandLimit(gameService.state()!, seatId);
    expect(over).toBeGreaterThan(0);

    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const dialog = overlay.querySelector('app-discard-dialog')!;
    expect(dialog).not.toBeNull();
    // The old per-card Discard buttons are gone from under the hand.
    expect((fixture.nativeElement as HTMLElement).querySelector('app-action-list')!.textContent).not.toContain('Discard');

    const cards = [...dialog.querySelectorAll('button.card')] as HTMLButtonElement[];
    cards.slice(0, over).forEach((c) => c.click());
    fixture.detectChanges();
    (dialog.querySelector('button.discard') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gameService.lastError()).toBeNull();
    expect(cardsOverHandLimit(gameService.state()!, seatId)).toBe(0);
    expect(gameService.state()!.turn.ownerSeatId).not.toBe(seatId);
    overlay.replaceChildren();
  });

  // A two-seat deal where the first seat's aimed Slash or Duel waits on the other seat's answer, with that seat revealed.
  function dealResponse(): void {
    for (let seed = 1; seed < 50; seed++) {
      gameService.startGame(2, seed);
      finishSelection(gameService);
      gameService.reveal(gameService.activeSeatId()!);
      const aimed = gameService.legalActions().find(
        (a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? '')
      );
      if (!aimed) continue;
      gameService.submit(aimed);
      if (waitsOnDamageAnswer(gameService.state()!)) break;
    }
    gameService.reveal(gameService.activeSeatId()!);
  }

  describe('minimizing a decision dialog', () => {
    async function openResponse() {
      dealResponse();
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      await fixture.whenStable();
      const pane = () => document.querySelector('.cdk-overlay-pane') as HTMLElement;
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, pane };
    }

    it('View Board hides the dialog and shows a banner; clicking the banner brings the dialog back', async () => {
      const { fixture, el, pane } = await openResponse();
      expect(el.querySelector('app-decision-banner .banner')).toBeNull();
      (pane().querySelector('button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(pane().classList).toContain('decision-minimized');
      // styles.scss hides the backdrop through its sibling wrapper, so the backdrop must come right before it.
      expect(pane().closest('.cdk-global-overlay-wrapper')!.previousElementSibling!.classList).toContain('cdk-overlay-backdrop');
      const banner = el.querySelector('app-decision-banner .banner') as HTMLButtonElement;
      expect(banner.textContent).toContain('Response Needed');
      banner.click();
      fixture.detectChanges();
      expect(pane().classList).not.toContain('decision-minimized');
      expect(el.querySelector('app-decision-banner .banner')).toBeNull();
    });

    it('an info dialog opened while minimized leaves the decision minimized', async () => {
      const { fixture, el } = await openResponse();
      (document.querySelector('.cdk-overlay-pane button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      TestBed.inject(MatDialog).open(InfoProbe);
      expect(el.querySelector('app-decision-banner .banner')).not.toBeNull();
      expect(document.querySelector('.decision-minimized')).not.toBeNull();
    });

    it('leaving the game while minimized closes the hidden dialog and clears the banner', async () => {
      const { fixture } = await openResponse();
      (document.querySelector('.cdk-overlay-pane button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      const dialog = TestBed.inject(MatDialog);
      fixture.destroy();
      expect(TestBed.inject(DecisionDock).minimized()).toBeNull();
      // Closing (the exit animation still runs), no longer open.
      expect(dialog.openDialogs.every((d) => d.getState() !== MatDialogState.OPEN)).toBe(true);
    });

    it('switching language while minimized rebuilds the decision in that language and keeps it minimized', async () => {
      localStorage.clear();
      const { fixture, el } = await openResponse();
      const englishSource = document.querySelector('.cdk-overlay-pane .source')!.textContent;
      (document.querySelector('.cdk-overlay-pane button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      await TestBed.inject(I18n).setLocale('vi');
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 400)); // the old dialog's exit, the new one's entrance
      fixture.detectChanges();
      expect(el.querySelector('app-decision-banner .banner')!.textContent).toContain('Cần phản hồi');
      const panes = document.querySelectorAll('.cdk-overlay-pane');
      expect(panes).toHaveLength(1);
      expect(panes[0].classList).toContain('decision-minimized');
      expect(panes[0].querySelector('.source')!.textContent).not.toBe(englishSource);
      localStorage.clear();
    });

    it('the rebuilt decision is never shown, not even for a moment', async () => {
      localStorage.clear();
      const { fixture } = await openResponse();
      (document.querySelector('.cdk-overlay-pane button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      // Every popup that appears from now on, and whether it was already hidden when it did.
      const seen: boolean[] = [];
      const observer = new MutationObserver((records) => {
        for (const node of records.flatMap((r) => [...r.addedNodes])) {
          const pane = node instanceof HTMLElement ? (node.matches('.cdk-overlay-pane') ? node : node.querySelector('.cdk-overlay-pane')) : null;
          if (pane) seen.push(pane.classList.contains('decision-minimized'));
        }
      });
      observer.observe(document.querySelector('.cdk-overlay-container')!, { childList: true, subtree: true });
      await TestBed.inject(I18n).setLocale('vi');
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 400));
      observer.disconnect();
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every(Boolean)).toBe(true);
      localStorage.clear();
    });

    it('the banner goes when the decision settles while minimized', async () => {
      const { fixture, el } = await openResponse();
      (document.querySelector('.cdk-overlay-pane button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      gameService.submit(gameService.legalActions().find((a) => a.kind === 'PassAction')!);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('app-decision-banner .banner')).toBeNull();
    });
  });

  it('opens the Response dialog for the seat that must answer, and No Response lets the effect go ahead', async () => {
    // Find a deal where the first seat can aim a card (Slash or Duel) at the other.
    // Its play must open the target's own answer (not a Wuxie question or an ask).
    let sha: Action | undefined; // the targeted play
    for (let seed = 1; seed < 50 && !sha; seed++) {
      gameService.startGame(2, seed);
      finishSelection(gameService);
      gameService.reveal(gameService.activeSeatId()!);
      const aimed = gameService.legalActions().find(
        (a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? '')
      );
      if (!aimed) continue;
      gameService.submit(aimed);
      if (waitsOnDamageAnswer(gameService.state()!)) sha = aimed;
    }
    expect(sha).toBeDefined();
    const responder = gameService.activeSeatId()!;
    expect(gameService.state()!.pendingResponse!.respondingSeatId).toBe(responder);
    const hpBefore = gameService.state()!.seats.find((x) => x.id === responder)!.combinedHp;
    gameService.reveal(responder);

    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const dialog = overlay.querySelector('app-response-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.source')!.textContent).toContain('played');
    // The answer controls live only in the dialog now.
    expect((fixture.nativeElement as HTMLElement).querySelector('app-action-list')!.textContent).not.toContain('Pass');

    // It starts on the first answering card if there is one, else No Response.
    const confirm = dialog.querySelector('button.confirm') as HTMLButtonElement;
    const hasCard = dialog.querySelectorAll('.card-option').length > 0;
    expect(confirm.textContent!.trim()).toEqual(hasCard ? expect.stringContaining('Respond with') : 'No Response');
    (dialog.querySelector('.no-response input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(confirm.textContent!.trim()).toBe('No Response');
    confirm.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(gameService.lastError()).toBeNull();
    expect(gameService.state()!.pendingResponse).toBeNull();
    expect(gameService.state()!.seats.find((x) => x.id === responder)!.combinedHp).toBeLessThan(hpBefore);
    overlay.replaceChildren();
  });

  it('opens the Choice dialog for a Steal or Break, and its button submits the picked option', async () => {
    let chose = false;
    for (let seed = 1; seed < 200 && !chose; seed++) {
      gameService.startGame(2, seed);
      finishSelection(gameService);
      gameService.reveal(gameService.activeSeatId()!);
      const grab = gameService.legalActions().find(
        (a) => a.kind === 'PlayCardAction' && ['steal', 'break'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? '')
      );
      if (!grab) continue;
      gameService.submit(grab);
      chose = !!gameService.state()!.pendingChoice;
    }
    expect(chose).toBe(true);
    gameService.reveal(gameService.activeSeatId()!);

    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const dialog = overlay.querySelector('app-choice-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.prompt')!.textContent).toMatch(/Choose a card to (take|discard) from Seat 1/);
    (dialog.querySelector('button.option') as HTMLButtonElement).click();
    fixture.detectChanges();
    (dialog.querySelector('button.confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(gameService.lastError()).toBeNull();
    expect(gameService.state()!.pendingChoice).toBeUndefined();
    overlay.replaceChildren();
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

    // Play out actions via the real engine until the game ends, with sim's
    // seeded random-legal-move bot (it fills selection templates), which the
    // sim's property spec proves terminates Kingdom War games.
    let rng = createRng(7);
    let guard = 0;
    while (!gameService.state()!.result && guard < 5000) {
      const seatId = gameService.activeSeatId()!;
      gameService.reveal(seatId);
      expect(gameService.legalActions().length).toBeGreaterThan(0);
      const picked = pickRandomAction(gameService.state()!, rng, gameService.registry);
      rng = picked.rng;
      gameService.submit(picked.action);
      guard++;
    }
    expect(gameService.state()!.result).not.toBeNull();

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-over')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
    expect(el.querySelector('app-phase-indicator')).toBeNull();
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
    expect(el.querySelector('app-phase-indicator')).toBeNull();
  });

  it('shows a waiting card while the bots choose their generals', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection')).toBeNull();
    expect(el.querySelector('.bots-choosing')!.textContent).toContain('Bots are choosing their Generals');
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
    expect(el.querySelector('.your-seat app-seat-tile')!.textContent).toContain('(you)');
    expect(el.querySelector('app-round-table .thinking')!.textContent).toContain('is thinking');
    // Nothing is playable while a bot acts (Review Focus 4).
    const playButtons = [...el.querySelectorAll('app-hand-view button.play')] as HTMLButtonElement[];
    expect(playButtons.every((b) => b.disabled)).toBe(true);
  });

  it('shows whose turn and which phase above the table', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    flushBots();
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!); // Continue past the Start window
    flushBots();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('app-phase-indicator')!;
    const timer = indicator.querySelector('app-decision-countdown')!;
    const label = indicator.textContent!.replace(timer.textContent!, '').replace(/\s+/g, ' ').trim();
    expect(label).toMatch(/^Turn 1 Seat 0 \(you\) – Play Phase Draw Pile \d+$/);
    // Your own Play phase is timed: 300 seconds for the whole phase.
    expect(timer.textContent).toContain('300s');
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
    const newGame = [...banner.querySelectorAll('button')].find((b) => b.textContent!.includes('New Game')) as HTMLButtonElement;
    newGame.click();
    expect(navigate).toHaveBeenCalledWith('/setup');
    jest.restoreAllMocks();
  });
});


describe('GameBoard event sounds', () => {
  let gameService: GameService;
  let played: string[];
  let fixture: ReturnType<typeof TestBed.createComponent<GameBoard>>;
  const logEvent = (event: GameState['log'][number]) => {
    (gameService as unknown as { _state: { update(f: (s: GameState) => GameState): void } })._state.update((s) => ({ ...s, log: [...s.log, event] }));
    fixture.detectChanges();
  };
  const effects = () => played.filter((u) => Object.values(EFFECT_URLS).includes(u));

  beforeEach(async () => {
    played = [];
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [
        provideRouter([{ path: 'setup', children: [] }]),
        { provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => ({ loop: false, volume: 1, play: () => (played.push(url), Promise.resolve()), pause: () => undefined }) },
      ],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1, 'vs-bots');
    fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
  });

  it('plays the injure sound when someone takes damage, once', () => {
    expect(effects()).toEqual([]);
    logEvent({ kind: 'DamageDealtEvent', damage: { target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 } } as never);
    expect(effects()).toEqual([EFFECT_URLS.injure]);
  });

  it('plays the injure sound for plain HP loss', () => {
    logEvent({ kind: 'HpLostEvent', seatId: 'seat-0', amount: 1 });
    expect(effects()).toEqual([EFFECT_URLS.injure]);
  });

  it('plays the heal sound when someone recovers HP', () => {
    logEvent({ kind: 'HealEvent', target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 });
    expect(effects()).toEqual([EFFECT_URLS.heal]);
  });

  describe('Compete popup', () => {
    const nine = { instanceId: 'c9', definitionId: 'sha', suit: 'spade' as const, rank: 9 };
    const seven = { instanceId: 'c7', definitionId: 'shan', suit: 'heart' as const, rank: 7 };
    const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'heavens-justice' };
    const compete = (): GameState['log'] => [
      { kind: 'CardShownEvent', seatId: 'seat-0', card: nine, abilityId: 'heavens-justice' },
      { kind: 'CardShownEvent', seatId: 'seat-1', card: seven, abilityId: 'heavens-justice' },
      { kind: 'AbilityUsedEvent', owner, abilityId: 'heavens-justice', outcome: 'compete-won', targetSeatId: 'seat-1' },
    ];
    const append = async (events: GameState['log']) => {
      (gameService as unknown as { _state: { update(f: (s: GameState) => GameState): void } })._state.update((s) => ({ ...s, log: [...s.log, ...events] }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const popups = () => document.querySelectorAll('app-compete-dialog');

    afterEach(() => TestBed.inject(MatDialog).closeAll());

    it('opens for a Compete that happens while the board is open, once', async () => {
      expect(popups()).toHaveLength(0);
      await append(compete());
      expect(popups()).toHaveLength(1);
      expect(popups()[0].textContent).toContain('Heaven');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(popups()).toHaveLength(1);
    });

    it('is themed in the source seat’s Force', async () => {
      await append(compete());
      const force = gameService.state()!.seats[0].kingdom;
      expect(document.querySelector('.cdk-overlay-pane')!.className).toContain(`force-dialog-${force === 'hidden' ? 'none' : force}`);
    });

    it('shows Competes one after another', async () => {
      await append([...compete(), ...compete()]);
      expect(popups()).toHaveLength(1);
      const first = popups()[0];
      (first.querySelector('button.continue') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 400));
      fixture.detectChanges();
      expect(popups()).toHaveLength(1);
      expect(popups()[0]).not.toBe(first);
    });
  });
});
