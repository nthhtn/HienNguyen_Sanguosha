import { pickRandomAction, ruleBasedPolicy } from 'bots';
import { Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogState } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { I18n } from '../i18n/i18n.service';
import { DecisionDock } from './decision-dock';
import { AskDialog } from './ask-dialog';
import { JudgmentDialog } from './judgment-dialog';
import { askToChange, settleJudgment } from '../settled-judgment.testing';
import { cardIdDisplayName } from '../labels';
import { GameBoard } from './game-board';
import { BattlefieldBackgrounds } from '../battlefield-background.service';
import { GameService } from '../game.service';
import { PlaybackSpeed } from '../playback-speed.service';
import { PlaybackDirector } from './playback/playback-director';
import { SeatTile } from './seat-tile';
import { CompeteDialog } from './compete-dialog';
import { MusicService } from '../music.service';
import { Action, GameState, cardsOverHandLimit, createRng } from 'engine';
import { GeneralSelection } from './general-selection';
import { HandView } from './hand-view';
import { cardDefinitionId } from '../labels';
import { EFFECT_URLS, MUSIC_PLAYER_FACTORY } from '../music.service';

@Component({ template: 'info' })
class InfoProbe {}

// Selection through to the first Play phase: a human seat with a hidden General
// first rests in its Start window, which Confirm (ConfirmRevealsAction) closes.
function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') {
    gameService.submit(gameService.legalActions()[0]);
  }
  if (gameService.state()!.turn.startWindow) {
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'ConfirmRevealsAction')!);
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
    // Not about playback: the board shows each new state at once (ruling R1).
    TestBed.inject(PlaybackSpeed).speed.set('instant');
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
    expect(el.querySelectorAll('app-general-selection [data-general-id]')).toHaveLength(7);
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

  it('opens the Start popup listing the hidden Generals; Confirm reveals the ticked ones and starts the turn', async () => {
    gameService.startGame(2, 1);
    while (gameService.state()!.phase === 'GeneralSelection') gameService.submit(gameService.legalActions()[0]);
    expect(gameService.state()!.turn.startWindow).toBe(true);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    // No Reveal buttons on the avatar and no Continue / End Phase buttons: the popup is the only way.
    expect(el.querySelectorAll('app-seat-avatar button.reveal')).toHaveLength(0);
    const buttons = [...el.querySelectorAll('app-action-list button')].map((b) => b.textContent!.trim());
    expect(buttons).not.toContain('Continue');
    expect(buttons).not.toContain('End Phase');
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const dialog = overlay.querySelector('app-start-reveal-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('h2')!.textContent).toContain('Reveal Generals');
    const rows = [...dialog.querySelectorAll('button.general')] as HTMLButtonElement[];
    expect(rows.map((r) => r.getAttribute('data-slot'))).toEqual(['main', 'deputy']);

    rows[1].click();
    fixture.detectChanges();
    (dialog.querySelector('button.confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const seat = gameService.state()!.seats.find((x) => x.id === seatId)!;
    expect(gameService.lastError()).toBeNull();
    expect(gameService.state()!.turn.startWindow).toBeFalsy();
    expect(seat.generals!.main.revealed).toBe(false);
    expect(seat.generals!.deputy.revealed).toBe(true);
    overlay.replaceChildren();
  });

  it('Confirm with nothing ticked starts the turn with every General still hidden', async () => {
    gameService.startGame(2, 1);
    while (gameService.state()!.phase === 'GeneralSelection') gameService.submit(gameService.legalActions()[0]);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    (overlay.querySelector('app-start-reveal-dialog button.confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const seat = gameService.state()!.seats.find((x) => x.id === seatId)!;
    expect(gameService.state()!.turn.startWindow).toBeFalsy();
    expect(gameService.state()!.phase).toBe('Play');
    expect(seat.generals!.main.revealed || seat.generals!.deputy.revealed).toBe(false);
    overlay.replaceChildren();
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
    hand.played.emit(cardPlay);
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
      // The banner wears the colours of the force the dialog is themed in.
      expect(`force-dialog-${banner.getAttribute('data-force') ?? 'none'}`).toBe([...pane().classList].find((c) => /^force-dialog-/.test(c)));
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
    // sim's property spec proves terminates Guozhan games.
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
    // Not about playback: the board shows each new state at once (ruling R1).
    TestBed.inject(PlaybackSpeed).speed.set('instant');
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

  describe('online General Selection', () => {
    const rows = [
      { seatId: 'seat-0', ready: false, isYou: true },
      { seatId: 'seat-1', ready: true, isYou: false },
    ];
    const online = (roster: typeof rows | null, startsAt: number | null = null) => {
      gameService.startGame(2, 1, 'vs-bots');
      const service = gameService as unknown as { selectionRoster: unknown; gameStartsAt: unknown };
      service.selectionRoster = signal(roster);
      service.gameStartsAt = signal(startsAt);
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('shows the selection controls and the roster side by side', () => {
      const el = online(rows);
      expect(el.querySelector('app-general-selection')).not.toBeNull();
      expect(el.querySelector('app-selection-roster')).not.toBeNull();
    });

    it('shows a ready seat the waiting message and the roster, not the Bots are choosing spinner', () => {
      gameService.startGame(2, 1, 'vs-bots');
      gameService.submit(gameService.legalActions()[0]);
      const service = gameService as unknown as { selectionRoster: unknown };
      service.selectionRoster = signal(rows.map((r) => ({ ...r, ready: true })));
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.waiting-others')!.textContent).toContain('Waiting for the other players to choose');
      expect(el.querySelector('.bots-choosing')).toBeNull();
      expect(el.querySelector('app-selection-roster')).not.toBeNull();
    });

    it('covers the board with the start countdown while a start time is set', () => {
      const el = online(null, Date.now() + 3000);
      expect(el.querySelector('app-game-start-countdown')).not.toBeNull();
    });

    it('shows no roster and no countdown in a local game', () => {
      gameService.startGame(2, 1, 'vs-bots');
      const fixture = TestBed.createComponent(GameBoard);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-selection-roster')).toBeNull();
      expect(el.querySelector('app-game-start-countdown')).toBeNull();
    });
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
    const humanMove = gameService.legalActions().find((a) => a.kind === 'ConfirmRevealsAction' || a.kind === 'EndPhaseAction');
    expect(humanMove).toBeDefined();
    // Advance the human to the end of their turn, so a bot is next.
    for (let i = 0; i < 10 && !gameService.botThinkingSeatId() && !gameService.state()!.result; i++) {
      const legal = gameService.legalActions();
      gameService.submit(legal.find((a) => a.kind === 'ConfirmRevealsAction' || a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
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
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'ConfirmRevealsAction')!); // Confirm past the Start window
    flushBots();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('app-phase-indicator')!;
    const timer = indicator.querySelector('app-decision-countdown')!;
    const label = indicator.textContent!.replace(timer.textContent!, '').replace(/\s+/g, ' ').trim();
    expect(label).toMatch(/^Turn 1 Seat 0 \(you\) – Play Phase Draw Pile \d+$/);
    // Your own Play phase is timed: 300 seconds for the whole phase.
    expect(timer.textContent).toContain('180s');
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
    // Not about playback: the board shows each new state at once (ruling R1).
    TestBed.inject(PlaybackSpeed).speed.set('instant');
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

    afterEach(() => {
      TestBed.inject(MatDialog).closeAll();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

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

    it('shows Competes one after another, each closing itself when its countdown ends', async () => {
      jest.useFakeTimers();
      await append([...compete(), ...compete()]);
      expect(popups()).toHaveLength(1);
      const first = popups()[0];
      expect(first.querySelector('button.continue')).toBeNull();
      jest.advanceTimersByTime(4200 + 5000);
      fixture.detectChanges();
      await fixture.whenStable();
      jest.advanceTimersByTime(400);
      fixture.detectChanges();
      expect(popups()).toHaveLength(1);
      expect(popups()[0]).not.toBe(first);
    });
  });
});

describe('GameBoard: the judgment popup', () => {
  let gameService: GameService;
  const overlayText = () => (document.querySelector('.cdk-overlay-container') as HTMLElement).textContent!;
  const popups = () => TestBed.inject(MatDialog).openDialogs.filter((d) => d.componentInstance instanceof JudgmentDialog && d.getState() === MatDialogState.OPEN);
  const settle = async (fixture: ReturnType<typeof TestBed.createComponent<GameBoard>>) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const start = (mode: 'vs-bots' | 'pass-and-play', eliminated: string[] = []) => {
    gameService.startGame(3, 1, mode, [], { judgmentNotice: true });
    settleJudgment(gameService, eliminated);
    return TestBed.createComponent(GameBoard);
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    // Not about playback: the board shows each new state at once (ruling R1).
    TestBed.inject(PlaybackSpeed).speed.set('instant');
    gameService.botDelayMs = 1_000_000;
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    jest.clearAllTimers();
    jest.useRealTimers();
    localStorage.clear();
  });

  it('opens the popup while a judgment is on show, and closes it when it is acknowledged', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    expect(popups()).toHaveLength(1);
    expect(overlayText()).toContain('Judgment');
    gameService.closeJudgment('seat-0');
    await settle(fixture);
    expect(popups()).toHaveLength(0);
  });

  it('the action list of the board does not offer the close, which belongs to the popup', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    const list = (fixture.nativeElement as HTMLElement).querySelector('app-action-list')!;
    expect(gameService.legalActions().some((a) => a.kind === 'AcknowledgeJudgmentAction')).toBe(true);
    expect([...list.querySelectorAll('button')].map((b) => b.textContent!.trim())).not.toContain('Close');
  });

  it('has no button to close the popup; its countdown acknowledges the judgment once the sequence has played', async () => {
    jest.useFakeTimers();
    const fixture = start('vs-bots');
    await settle(fixture);
    expect(document.querySelector('.cdk-overlay-container button.close')).toBeNull();
    expect(document.querySelector('.cdk-overlay-container mat-dialog-actions button')).toBeNull();
    jest.advanceTimersByTime(2100 + 2000 + 5000 + 500);
    await settle(fixture);
    expect(gameService.judgmentSettled()).toBe(false);
    expect(gameService.state()!.log.find((e) => e.kind === 'JudgmentAcknowledgedEvent')).toMatchObject({ seatId: 'seat-0', source: 'timeout' });
  });

  it('in Pass and Play the popup opens over the gate, and closes itself from there', async () => {
    jest.useFakeTimers();
    const fixture = start('pass-and-play');
    await settle(fixture);
    expect(gameService.revealedSeatId()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(popups()).toHaveLength(1);
    jest.advanceTimersByTime(2100 + 2000 + 5000 + 500);
    await settle(fixture);
    expect(gameService.judgmentSettled()).toBe(false);
  });

  it('shows no hand card of any seat', async () => {
    const fixture = start('pass-and-play');
    await settle(fixture);
    const state = gameService.state()!;
    const hidden = state.zones.filter((z) => z.kind === 'hand').flatMap((z) => z.cards).map((c) => cardIdDisplayName(c.definitionId)).filter((n) => n !== cardIdDisplayName('sha') && n !== 'Lightning');
    expect(hidden.length).toBeGreaterThan(0);
    for (const name of new Set(hidden)) expect(overlayText()).not.toContain(name);
  });

  it('minimizing it shows the banner titled Judgment; clicking the banner restores it', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    (document.querySelector('.cdk-overlay-container button.minimize') as HTMLButtonElement).click();
    fixture.detectChanges();
    const pane = document.querySelector('.cdk-overlay-pane') as HTMLElement;
    expect(pane.classList).toContain('decision-minimized');
    const banner = (fixture.nativeElement as HTMLElement).querySelector('app-decision-banner .banner') as HTMLButtonElement;
    expect(banner.textContent).toContain('Judgment');
    banner.click();
    fixture.detectChanges();
    expect(pane.classList).not.toContain('decision-minimized');
  });

  it('updates the same popup in place when the judgment changes', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    const [first] = popups();
    const inner = gameService as unknown as { _state: { update(f: (s: GameState) => GameState): void } };
    const swap = { instanceId: 'swap-1', definitionId: 'shan', suit: 'spade' as const, rank: 13 };
    inner._state.update((s) => ({
      ...s,
      judgmentView: { ...s.judgmentView!, card: swap, settled: false, changes: [{ owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'unyielding' }, abilityId: 'unyielding', card: swap, replaced: s.judgmentView!.card }] },
    }));
    await settle(fixture);
    expect(popups()).toEqual([first]);
    expect(overlayText()).toContain('replaced');
    expect(overlayText()).toContain('Waiting for');
    expect(document.querySelector('.cdk-overlay-container button.close')).toBeNull();
  });

  it('a second judgment after the first is closed gets a new popup', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    const [first] = popups();
    gameService.closeJudgment('seat-0');
    await settle(fixture);
    settleJudgment(gameService);
    await settle(fixture);
    expect(popups()).toHaveLength(1);
    expect(popups()[0]).not.toBe(first);
  });

  it('a viewer whose seat is a bot sees the popup and its countdown', async () => {
    const fixture = start('vs-bots', ['seat-0']);
    await settle(fixture);
    expect(popups()).toHaveLength(1);
    expect(document.querySelector('.cdk-overlay-container button.close')).toBeNull();
    expect(document.querySelector('.cdk-overlay-container app-decision-countdown')).not.toBeNull();
  });

  it('switching language updates the open popup, and a minimized one including its banner', async () => {
    const fixture = start('vs-bots');
    await settle(fixture);
    const title = () => document.querySelector('.cdk-overlay-container h2')!.textContent;
    expect(title()).toContain('Judgment');
    await TestBed.inject(I18n).setLocale('vi');
    await settle(fixture);
    expect(title()).toContain('Phán xét');
    (document.querySelector('.cdk-overlay-container button.minimize') as HTMLButtonElement).click();
    fixture.detectChanges();
    await TestBed.inject(I18n).setLocale('en');
    await settle(fixture);
    await new Promise((resolve) => setTimeout(resolve, 400));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-decision-banner .banner')!.textContent).toContain('Judgment');
    expect(popups()).toHaveLength(1);
  });

  describe('a skill that may change the card', () => {
    const asks = () => TestBed.inject(MatDialog).openDialogs.filter((d) => d.componentInstance instanceof AskDialog);
    const afterHead = (fixture: ReturnType<typeof TestBed.createComponent<GameBoard>>) => {
      jest.advanceTimersByTime(2100);
      fixture.detectChanges();
    };

    it('asks inside the Judgment popup, not in a second dialog, and submits the engine’s own action', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      expect(popups()).toHaveLength(1);
      expect(asks()).toHaveLength(0);
      afterHead(fixture);
      const use = document.querySelector('.cdk-overlay-container .decide button.use') as HTMLButtonElement;
      expect(use).not.toBeNull();
      use.click();
      await settle(fixture);
      expect(gameService.state()!.pendingChoice).toBeUndefined();
    });

    it('still opens the Ask dialog for an ask that is not a changer’s', async () => {
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0', 1, false);
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      expect(asks()).toHaveLength(1);
    });

    it('shows others only a waiting line for the seat that is asked', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-1');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      afterHead(fixture);
      expect(document.querySelector('.cdk-overlay-container .decide .waiting')!.textContent).toContain('Waiting for');
      expect(document.querySelector('.cdk-overlay-container .decide button')).toBeNull();
      expect(asks()).toHaveLength(0);
    });

    it('keeps the decision when the popup is minimized and restored', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      afterHead(fixture);
      const panel = document.querySelector('.cdk-overlay-container .decide app-ask-panel');
      expect(panel).not.toBeNull();
      (document.querySelector('.cdk-overlay-container button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(document.querySelector('.cdk-overlay-pane')!.classList).toContain('decision-minimized');
      ((fixture.nativeElement as HTMLElement).querySelector('app-decision-banner .banner') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(document.querySelector('.cdk-overlay-container .decide app-ask-panel')).toBe(panel);
      expect(gameService.state()!.pendingChoice).toBeDefined();
    });

    it('keeps its place when the language is switched while it is minimized: the rebuilt popup does not replay the sequence', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      afterHead(fixture);
      (document.querySelector('.cdk-overlay-container button.minimize') as HTMLButtonElement).click();
      fixture.detectChanges();
      await TestBed.inject(I18n).setLocale('vi');
      await settle(fixture);
      jest.advanceTimersByTime(500);
      await settle(fixture);
      jest.advanceTimersByTime(50);
      fixture.detectChanges();
      // No beats advanced since the switch, yet the decision is open: the sequence is not replayed from the start.
      expect(document.querySelector('.cdk-overlay-container .decide app-ask-panel')).not.toBeNull();
      expect(gameService.state()!.pendingChoice).toBeDefined();
    });

    it('does not let a half-made card pick become the answer when the clock runs out', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      const timer = fixture.componentInstance as unknown as { timer: { setTimeoutChoice(actions: unknown[]): void } };
      const spy = jest.spyOn(timer.timer, 'setTimeoutChoice');
      afterHead(fixture);
      expect(document.querySelector('.cdk-overlay-container .decide')).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();
      // Nothing the viewer picks inside the popup is remembered for a timeout: it declines, as the spec says.
      const dialog = TestBed.inject(MatDialog).openDialogs.find((d) => d.componentInstance instanceof JudgmentDialog)!;
      expect((dialog.componentInstance as unknown as { data: { pickedChanged?: unknown } }).data.pickedChanged).toBeUndefined();
    });

    it('in Pass and Play, the hand-off comes first, inside the popup, then the private choices', async () => {
      jest.useFakeTimers();
      gameService.startGame(3, 1, 'pass-and-play', [], { judgmentNotice: true });
      askToChange(gameService, 'seat-0');
      const fixture = TestBed.createComponent(GameBoard);
      await settle(fixture);
      afterHead(fixture);
      expect(gameService.revealedSeatId()).toBeNull();
      expect(document.querySelector('.cdk-overlay-container .decide app-ask-panel')).toBeNull();
      (document.querySelector('.cdk-overlay-container .decide button.reveal') as HTMLButtonElement).click();
      await settle(fixture);
      expect(gameService.revealedSeatId()).toBe('seat-0');
      expect(document.querySelector('.cdk-overlay-container .decide app-ask-panel')).not.toBeNull();
      expect(asks()).toHaveLength(0);
    });
  });
});

describe('GameBoard battle playback', () => {
  let gameService: GameService;
  let played: string[];
  let fixture: ReturnType<typeof TestBed.createComponent<GameBoard>>;
  const internal = () => gameService as unknown as { _state: { update(f: (s: GameState) => GameState): void } };
  const update = (change: (s: GameState) => GameState) => {
    internal()._state.update(change);
    fixture.detectChanges();
  };
  const append = (events: GameState['log']) => update((s) => ({ ...s, log: [...s.log, ...events] }));
  const tick = (ms: number) => {
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = () => {
    fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
  };
  const effects = () => played.filter((u) => Object.values(EFFECT_URLS).includes(u));
  const director = () => fixture.debugElement.injector.get(PlaybackDirector);
  const openDialogs = <T>(type: new (...args: never[]) => T) =>
    TestBed.inject(MatDialog).openDialogs.filter((d) => d.componentInstance instanceof type && d.getState() === MatDialogState.OPEN);
  // A Pass and Play game in its first Play Phase, the turn owner revealed; returns the other seat.
  const playPhase = (): string => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    return gameService.state()!.seats.find((s) => s.id !== gameService.activeSeatId())!.id;
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    played = [];
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [
        provideRouter([{ path: 'setup', children: [] }]),
        { provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => ({ loop: false, volume: 1, play: () => (played.push(url), Promise.resolve()), pause: () => undefined }) },
      ],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    gameService.botDelayMs = 1_000_000;
    gameService.instantBotDelayMs = 1_000_000;
    TestBed.inject(PlaybackSpeed).speed.set('normal');
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('the hand is not playable while playback is busy', () => {
    const other = playPhase();
    create();
    const hand = () => fixture.debugElement.query(By.directive(HandView)).componentInstance as HandView;
    expect(hand().actions().length).toBeGreaterThan(0);
    append([{ kind: 'HpLostEvent', seatId: other, amount: 1 }]);
    expect(director().idle()).toBe(false);
    expect(hand().actions()).toEqual([]);
    tick(900 + 350);
    expect(director().idle()).toBe(true);
    expect(hand().actions().length).toBeGreaterThan(0);
  });

  it('the response dialog opens only after playback', async () => {
    // A deal where the first seat's aimed Slash or Duel waits on the other seat's own answer.
    let found: number | null = null;
    for (let seed = 1; seed < 50 && found === null; seed++) {
      gameService.startGame(2, seed);
      finishSelection(gameService);
      const aimed = gameService.legalActions().find((a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? ''));
      if (!aimed) continue;
      gameService.submit(aimed);
      if (waitsOnDamageAnswer(gameService.state()!)) found = seed;
    }
    expect(found).not.toBeNull();
    gameService.startGame(2, found!);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    create();
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? ''))!);
    fixture.detectChanges();
    // The gate is up; the answering seat reveals and the play is shown first.
    gameService.reveal(gameService.activeSeatId()!);
    await settle();
    expect(director().idle()).toBe(false);
    expect(document.querySelector('app-response-dialog')).toBeNull();
    tick(5000);
    await settle();
    expect(director().idle()).toBe(true);
    expect(document.querySelector('app-response-dialog')).not.toBeNull();
  });

  it('a Slash and the Dodge that answers it in a later update share the resolution, and nothing stays on the overlay while idle', () => {
    const sha = (state: GameState, id: string) => cardDefinitionId(state, id) === 'sha';
    const slashAt = (target: string) =>
      gameService.legalActions().find((a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && a.targets[0].kind === 'seat' && a.targets[0].seatId === target && sha(gameService.state()!, a.cardInstanceId));
    const dodges = () => {
      const state = gameService.state()!;
      return state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === 'seat-1')!.cards.some((c) => c.definitionId === 'shan');
    };
    // A vs-bots deal where the human's first Play Phase has a Slash at the bot, and the bot holds a Dodge.
    gameService.botDelayMs = 0;
    let found = false;
    for (let seed = 1; seed < 80 && !found; seed++) {
      gameService.startGame(2, seed, 'vs-bots');
      const inOwnPlay = () => gameService.state()!.turn.ownerSeatId === 'seat-0' && gameService.state()!.phase === 'Play';
      for (let guard = 0; guard < 2000 && !inOwnPlay() && !gameService.state()!.result; guard++) {
        const legal = gameService.legalActions();
        if (legal.length > 0) gameService.submit(legal.find((a) => a.kind === 'ConfirmRevealsAction' || a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
        else jest.runOnlyPendingTimers();
      }
      found = inOwnPlay() && !!slashAt('seat-1') && dodges();
    }
    expect(found).toBe(true);
    // The bot answers some time after playback catches up, so its Dodge comes in an update of its own.
    gameService.botDelayMs = 3000;
    create();
    const el = fixture.nativeElement as HTMLElement;
    const shownCards = () => el.querySelectorAll('app-playback-layer .played app-playing-card').length;
    const arrows = () => el.querySelectorAll('app-playback-layer g.arrow').length;
    const untilIdle = () => {
      for (let i = 0; i < 200 && !director().idle(); i++) tick(100);
    };
    gameService.submit(slashAt('seat-1')!);
    fixture.detectChanges();
    untilIdle();
    expect(director().idle()).toBe(true);
    expect(gameService.state()!.pendingResponse?.respondingSeatId).toBe('seat-1');
    expect(director().centreStack().map((u) => u.as)).toEqual(['sha']);
    expect(shownCards()).toBe(0);
    expect(arrows()).toBe(0);
    tick(3000);
    expect(gameService.state()!.log.some((e) => e.kind === 'CardPlayedEvent' && e.seatId === 'seat-1' && e.card.as === 'shan')).toBe(true);
    untilIdle();
    expect(director().centreStack().map((u) => u.as)).toEqual(['sha', 'shan']);
    expect(shownCards()).toBe(0);
    expect(arrows()).toBe(0);
  });

  it('dims the seats a play does not involve only while that play is on show', () => {
    gameService.startGame(3, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    create();
    const [user, target, bystander] = [gameService.activeSeatId()!, ...gameService.state()!.seats.map((s) => s.id).filter((id) => id !== gameService.activeSeatId())];
    const dimmed = (seatId: string) =>
      fixture.debugElement
        .queryAll(By.directive(SeatTile))
        .map((d) => d.componentInstance as SeatTile)
        .find((t) => t.seat().id === seatId)!
        .dimmed();
    const sha = { as: 'sha', colour: 'black', suit: 'spade', rank: 7, physical: [{ instanceId: 'x-sha', definitionId: 'sha', suit: 'spade', rank: 7 }] };
    append([{ kind: 'CardPlayedEvent', seatId: user, card: sha, targets: [{ kind: 'seat', seatId: target }] } as never]);
    expect(dimmed(bystander)).toBe(true);
    expect(dimmed(target)).toBe(false);
    expect(dimmed(user)).toBe(false);
    tick(2000);
    expect(director().idle()).toBe(true);
    expect([user, target, bystander].map(dimmed)).toEqual([false, false, false]);
  });

  it('HP on the seat tile drops when the damage beat plays', () => {
    const other = playPhase();
    create();
    const tile = () =>
      fixture.debugElement
        .queryAll(By.directive(SeatTile))
        .map((d) => d.componentInstance as SeatTile)
        .find((t) => t.seat().id === other)!;
    const before = tile().seat().combinedHp;
    update((s) => ({
      ...s,
      seats: s.seats.map((seat) => (seat.id === other ? { ...seat, combinedHp: seat.combinedHp - 2 } : seat)),
      log: [...s.log, { kind: 'HpLostEvent', seatId: other, amount: 1 }, { kind: 'DamageDealtEvent', damage: { target: { kind: 'seat', seatId: other }, amount: 1 } } as never],
    }));
    expect(tile().seat().combinedHp).toBe(before - 1);
    tick(900);
    expect(tile().seat().combinedHp).toBe(before - 2);
  });

  it('waits for playback before Game Over (Review Focus 4)', () => {
    const other = playPhase();
    create();
    const tracks = jest.spyOn(TestBed.inject(MusicService), 'setTrack');
    const winner = gameService.activeSeatId()!;
    update((s) => ({
      ...s,
      seats: s.seats.map((seat) => (seat.id === other ? { ...seat, eliminated: true } : seat)),
      log: [...s.log, { kind: 'SeatEliminatedEvent', seatId: other } as never],
      result: { endedAt: 1, winningSeatIds: [winner], losingSeatIds: [other] },
    }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-over')).toBeNull();
    expect(el.querySelector('app-round-table')).not.toBeNull();
    expect(tracks).not.toHaveBeenCalledWith('win');
    tick(1400 + 350);
    expect(el.querySelector('app-game-over')).not.toBeNull();
    expect(tracks).toHaveBeenLastCalledWith('win');
  });

  it('plays a sound with its beat, not with the batch', () => {
    playPhase();
    create();
    const seatId = gameService.activeSeatId()!;
    append([{ kind: 'DamageDealtEvent', damage: { target: { kind: 'seat', seatId }, amount: 1 } } as never, { kind: 'HealEvent', target: { kind: 'seat', seatId }, amount: 1 }]);
    expect(effects()).toEqual([EFFECT_URLS.injure]);
    tick(900);
    expect(effects()).toEqual([EFFECT_URLS.injure, EFFECT_URLS.heal]);
  });

  it('a judgment that follows another opens only once playback reaches it', async () => {
    gameService.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
    settleJudgment(gameService);
    create();
    await settle();
    expect(openDialogs(JudgmentDialog)).toHaveLength(1);
    const view = gameService.state()!.judgmentView;
    const lost = (seatId: string): GameState['log'][number] => ({ kind: 'HpLostEvent', seatId, amount: 1 });
    // The first ends with beats still to play; the next arrives while they play.
    update((s) => ({ ...s, judgmentView: undefined, log: [...s.log, lost('seat-1')] }));
    await settle();
    expect(openDialogs(JudgmentDialog)).toHaveLength(0);
    update((s) => ({ ...s, judgmentView: view, log: [...s.log, lost('seat-2')] }));
    await settle();
    expect(director().idle()).toBe(false);
    expect(openDialogs(JudgmentDialog)).toHaveLength(0);
    tick(5000);
    await settle();
    expect(openDialogs(JudgmentDialog)).toHaveLength(1);
  });

  it('Pass and Play: the move that ends the game plays out before Game Over', () => {
    // The same seeded moves twice: first to count them, then to stop before the last one.
    const play = (moves: number) => {
      gameService.startGame(2, 1);
      let rng = createRng(7);
      let made = 0;
      while (!gameService.state()!.result && made < moves) {
        gameService.reveal(gameService.activeSeatId()!);
        const picked = pickRandomAction(gameService.state()!, rng, gameService.registry);
        rng = picked.rng;
        gameService.submit(picked.action);
        made++;
      }
      return { made, rng };
    };
    const { made: total } = play(5000);
    expect(gameService.state()!.result).toBeTruthy();
    const { rng } = play(total - 1);
    expect(gameService.state()!.result).toBeFalsy();
    gameService.reveal(gameService.activeSeatId()!);
    create();
    gameService.submit(pickRandomAction(gameService.state()!, rng, gameService.registry).action);
    fixture.detectChanges();
    expect(gameService.state()!.result).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(director().idle()).toBe(false);
    expect(el.querySelector('app-game-over')).toBeNull();
    expect(el.querySelector('app-round-table')).not.toBeNull();
    tick(60_000);
    expect(director().idle()).toBe(true);
    expect(el.querySelector('app-game-over')).not.toBeNull();
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
    const heal: GameState['log'][number] = { kind: 'HealEvent', target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 };

    it('local: playback waits while a Compete popup is open', async () => {
      gameService.startGame(2, 1, 'vs-bots');
      create();
      append([...compete(), heal]);
      await settle();
      expect(openDialogs(CompeteDialog)).toHaveLength(1);
      tick(5000);
      expect(director().idle()).toBe(false);
      expect(effects()).not.toContain(EFFECT_URLS.heal);
      TestBed.inject(MatDialog).closeAll();
      await settle();
      tick(1000);
      expect(effects()).toContain(EFFECT_URLS.heal);
      tick(1000);
      expect(director().idle()).toBe(true);
    });

    // The online board: nothing waits for playback, and the viewer's legal actions are set by the test.
    const goOnline = () => {
      gameService.startGame(2, 1, 'vs-bots');
      const owed = signal<Action[]>([]);
      const online = gameService as unknown as { clockWaitsForPlayback: boolean; legalActions: unknown };
      online.clockWaitsForPlayback = false;
      online.legalActions = owed;
      create();
      return owed;
    };

    it('online: an open Compete popup closes when the viewer owes a decision', async () => {
      const owed = goOnline();
      append([...compete(), heal]);
      await settle();
      expect(openDialogs(CompeteDialog)).toHaveLength(1);
      // Nothing holds online: playback goes on behind the popup.
      tick(5000);
      expect(director().idle()).toBe(true);
      expect(openDialogs(CompeteDialog)).toHaveLength(1);
      update((s) => ({ ...s, pendingResponse: { id: 'r1', respondingSeatId: 'seat-0', allowedActionKinds: ['PassAction'], context: { effect: { kind: 'noop' } as never } } }));
      owed.set([{ kind: 'EndPhaseAction', seatId: 'seat-0' } as Action]);
      await settle();
      expect(openDialogs(CompeteDialog)).toHaveLength(0);
    });

    it('online: a Compete in the viewer’s own Play Phase still shows', async () => {
      const owed = goOnline();
      // Free play is not a decision owed: the popup opens and stays.
      update((s) => ({ ...s, phase: 'Play', turn: { ...s.turn, ownerSeatId: 'seat-0' } }));
      owed.set([{ kind: 'EndPhaseAction', seatId: 'seat-0' } as Action]);
      append([...compete(), heal]);
      await settle();
      expect(openDialogs(CompeteDialog)).toHaveLength(1);
      tick(2000);
      await settle();
      expect(openDialogs(CompeteDialog)).toHaveLength(1);
    });
  });
});
