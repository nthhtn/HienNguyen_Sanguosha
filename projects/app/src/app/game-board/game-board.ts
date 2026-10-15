import { Component, DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Action, CardInstance, ChooseGeneralsAction, Seat, discardOwed } from 'engine';

type DiscardCardAction = Extract<Action, { kind: 'DiscardCardAction' }>;
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { RoundTable } from './round-table';
import { SeatTile, seatIsDying } from './seat-tile';
import { HandView } from './hand-view';
import { GameOver } from './game-over';
import { GeneralSelection } from './general-selection';
import { PhaseIndicator } from './phase-indicator';
import { DiscardPile } from './discard-pile';
import { conversionLabel, forceOf, seatName } from '../labels';
import { discardHistory } from './discard-history';
import { ActionHistoryPanel } from './action-history-panel';
import { actionHistory } from './action-history';
import { DiscardDialog, DiscardDialogData } from './discard-dialog';
import { ResponseDialog, ResponseDialogData, ResponseOption } from './response-dialog';
import { describeResponse, startsOnNoResponse } from './response-description';
import { ChoiceDialog, ChoiceDialogData } from './choice-dialog';
import { AskDialog, AskDialogData } from './ask-dialog';
import { SelectionDialog, SelectionDialogData } from './selection-dialog';
import { describeArrangement, describeAsk, describeSelection } from './ability-description';
import { ArrangeDialog, ArrangeDialogData } from './arrange-dialog';
import { avatarSkills, extraSkillsOf } from './avatar-skills';
import { choiceDialogOptions, describeChoice } from './choice-description';
import { openForceDialog } from './force-dialog';
import { CompeteDialog } from './compete-dialog';
import { CompeteResult, competeResults } from './compete-result';
import { deathSoundsFor, soundsFor, voicesFor } from './event-sounds';
import { MusicService, SoundEffects } from '../music.service';
import { DecisionTimer } from '../decision-timer.service';

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, PhaseIndicator, RoundTable, SeatTile, HandView, GameOver, GeneralSelection, DiscardPile, ActionHistoryPanel, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    @if (lastError(); as error) {
      <div class="error-banner" role="alert">
        <mat-icon>error</mat-icon>
        <span class="message">{{ error }}</span>
        @if (gameService.mode() === 'vs-bots' && gameService.state() && !gameService.state()!.result) {
          <!-- A failed bot move stops the bots, so give the player a way out. -->
          <button mat-button type="button" (click)="goToSetup()">New Game</button>
        }
        <button mat-button type="button" (click)="dismissError()">Dismiss</button>
      </div>
    }

    @if (gameService.state(); as state) {
      @if (state.result; as result) {
        <app-game-over [result]="result" [players]="state.players" (newGame)="goToSetup()" />
      } @else if (activeSeatId(); as activeSeatId) {
        @if (gameService.humanSeatId() === null && gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [name]="nameOf(activeSeatId)" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection' && activeSeatId !== viewerSeatId()) {
            <mat-card appearance="outlined" class="bots-choosing">
              <mat-progress-spinner mode="indeterminate" diameter="28" />
              <span>Bots are choosing their Generals…</span>
            </mat-card>
          } @else if (visible.phase === 'GeneralSelection') {
            <app-general-selection
              [candidates]="selectionCandidates()"
              [actions]="generalChoices()"
              [registry]="gameService.registry"
              [seatId]="activeSeatId"
              [seatName]="nameOf(activeSeatId)"
              (chosen)="submit($event)"
            />
          } @else {
            <div class="board">
              <app-phase-indicator [state]="visible" [viewerSeatId]="viewerSeatId()" />
              <div class="board-grid">
                <app-round-table class="battlefield" [state]="visible" [viewerSeatId]="viewerSeatId()!" [thinkingSeatId]="gameService.botThinkingSeatId()" [botSeatIds]="gameService.botSeatIds()" />
                <!-- Bottom left corner: the viewer's own seat, off the table. -->
                @if (viewerSeat(); as seat) {
                  <div class="your-seat">
                    <app-seat-tile
                      [seat]="seat"
                      [name]="nameOf(seat.id)"
                      [handCount]="ownHand().length"
                      [isViewer]="true"
                      [isTurnOwner]="seat.id === visible.turn.ownerSeatId"
                      [isResponding]="seat.id === (visible.pendingChoice?.seatId ?? visible.pendingResponse?.respondingSeatId)"
                      [isBot]="gameService.botSeatIds().includes(seat.id)"
                      [equipment]="zoneCards(seat.equipped.zoneId)"
                      [judgment]="zoneCards(seat.judgment.zoneId)"
                      [judgmentCountsAs]="countsAsOf(seat.judgment.zoneId)"
                      [pile]="zoneCards(seat.pile?.zoneId ?? '')"
                      [stash]="zoneCards(seat.stash?.zoneId ?? '')"
                      [dying]="dyingOf(seat)"
                      [skills]="viewerSkills()"
                      (useSkill)="submit($event)"
                    />
                  </div>
                }
                <section class="your-hand">
                  <div class="hand">
                    <h3>Your Hand</h3>
                    <app-hand-view
                      [cards]="ownHand()"
                      [actions]="gameService.legalActions()"
                      [state]="visible"
                      [registry]="gameService.registry"
                      (play)="submit($event)"
                    />
                  </div>
                  <app-action-list
                    class="actions"
                    [actions]="gameService.legalActions()"
                    [state]="visible"
                    [registry]="gameService.registry"
                    (actionChosen)="submit($event)"
                  />
                </section>
                <!-- Bottom right: the action history, then the discard pile; same height. -->
                <app-action-history class="history" [history]="actionHistory()" />
                <app-discard-pile class="discard" [cards]="discardPile()?.cards ?? []" [history]="discardHistory()" />
              </div>
            </div>
          }
        }
      }
    } @else {
      <p>No game in progress.</p>
      <a mat-flat-button routerLink="/setup">Start a New Game</a>
    }
  `,
  styles: `
    .error-banner {
      display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 8px 12px; border-radius: 12px;
      background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container);
    }
    .error-banner .message { flex: 1; }
    .bots-choosing { display: flex; align-items: center; gap: 16px; padding: 24px; margin: 24px auto; max-width: 420px; }
    /* The game board fits the window below the app bar: no page scroll. The
       battlefield takes the room the hand row and the side column leave. */
    :host:has(.board) {
      display: flex; flex-direction: column;
      height: calc(100dvh - var(--mat-toolbar-standard-height, 64px) - 16px);
    }
    @media (max-width: 599px) { :host:has(.board) { height: calc(100dvh - var(--mat-toolbar-mobile-height, 56px) - 16px); } }
    .board { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    /* Bottom row: Player Seat, Hand (the rest of the width), Action History, Discard Pile.
       All four sections share one fixed height, so the battlefield gets the rest. */
    .board-grid {
      --bottom-height: 200px;
      flex: 1; min-height: 0;
      display: grid; gap: 8px;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      grid-template-rows: minmax(0, 1fr) var(--bottom-height);
      grid-template-areas: 'battlefield battlefield battlefield battlefield' 'seat hand history discard';
    }
    /* The battlefield runs the full width of the screen: out past the page padding. */
    .battlefield { grid-area: battlefield; margin-inline: -16px; min-height: 0; }
    /* The seat tile is shrunk to fit the row, and stretched to the row's full height. */
    .your-seat { --seat-zoom: 0.78; grid-area: seat; overflow: hidden; zoom: var(--seat-zoom); height: calc(var(--bottom-height) / var(--seat-zoom)); }
    .your-seat app-seat-tile { display: block; height: 100%; }
    .your-hand {
      grid-area: hand; min-width: 0; overflow: hidden; box-sizing: border-box;
      display: flex; align-items: stretch; gap: 12px; padding: 6px 10px; border-radius: 12px;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface);
    }
    .hand { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .your-hand h3 { margin: 0; font: var(--mat-sys-label-large); }
    .your-hand app-hand-view { display: block; }
    .actions { align-self: center; max-width: 320px; }
    .history { grid-area: history; }
    .discard { grid-area: discard; }
    .history, .discard { box-sizing: border-box; width: 140px; min-height: 0; overflow: hidden; justify-content: center; }
    /* Phone-sized: stack, and let the page scroll. */
    @media (max-width: 767px) {
      :host:has(.board) { height: auto; }
      .board-grid {
        --bottom-height: auto;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        grid-template-rows: 70vh auto auto auto;
        grid-template-areas: 'battlefield battlefield' 'seat seat' 'hand hand' 'history discard';
      }
      .your-seat { justify-self: center; height: auto; }
      .your-seat app-seat-tile { height: auto; }
      .your-hand { flex-direction: column; }
      .actions { max-width: none; }
      .history, .discard { width: auto; }
    }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly timer = inject(DecisionTimer);
  private readonly music = inject(MusicService);
  private readonly sounds = inject(SoundEffects);
  private discardDialog: MatDialogRef<DiscardDialog, string[]> | null = null;
  private responseDialog: MatDialogRef<ResponseDialog, Action> | null = null;
  private choiceDialog: MatDialogRef<unknown, Action> | null = null;
  private selectionDialog: MatDialogRef<SelectionDialog, Action> | null = null;
  // The selection whose dialog is showing, so each opens only once.
  private selectionDialogFor: string | null = null;
  // The selection the viewer owes, while the board is on screen and the engine offers it.
  protected readonly selectionDue = computed(() => {
    const selection = this.visibleState()?.pendingSelection;
    if (!selection || selection.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'SelectAction') ? selection.id : null;
  });
  private arrangeDialog: MatDialogRef<ArrangeDialog, Action> | null = null;
  // The arrangement whose dialog is showing, so each opens only once.
  private arrangeDialogFor: string | null = null;
  // The arrangement the viewer owes, while the board is on screen and the engine offers it.
  protected readonly arrangementDue = computed(() => {
    const arrangement = this.visibleState()?.pendingArrangement;
    if (!arrangement || arrangement.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ArrangeCardsAction') ? arrangement.id : null;
  });
  // The choice whose dialog is showing, so each opens only once.
  private choiceDialogFor: string | null = null;
  // The choice the viewer owes, while the board is on screen and the engine
  // offers them its options.
  protected readonly choiceDue = computed(() => {
    const choice = this.visibleState()?.pendingChoice;
    if (!choice || choice.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ChooseOptionAction') ? choice.id : null;
  });
  // The response window whose dialog is showing, so each opens only once.
  private responseDialogFor: string | null = null;

  // The response window the viewer owes an answer to, while the board is on
  // screen and the engine offers them a way to answer it.
  protected readonly responseDue = computed(() => {
    const visible = this.visibleState();
    const pending = visible?.pendingResponse;
    if (!visible || !pending || pending.respondingSeatId !== this.viewerSeatId()) return null;
    const legal = this.gameService.legalActions();
    return legal.some((a) => a.kind === 'PassAction' || a.kind === 'RespondAction') ? pending.id : null;
  });

  // How many cards the viewer must discard now: non-zero only in their own
  // Discard phase while the engine offers discards (the board is on screen).
  protected readonly discardsDue = computed(() => {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (!visible || !seatId || visible.phase !== 'Discard' || visible.turn.ownerSeatId !== seatId) return 0;
    if (!this.gameService.legalActions().some((a) => a.kind === 'DiscardCardAction')) return 0;
    return discardOwed(visible, seatId);
  });

  constructor() {
    // Decisions are timed only while the board is on screen.
    this.timer.attach(inject(DestroyRef));
    // The win track while the game is won; back to the background track on leaving.
    effect(() => this.music.setTrack(this.visibleState()?.result ? 'win' : 'background'));
    inject(DestroyRef).onDestroy(() => this.music.setTrack('background'));
    // Event sounds (soundsFor) for whatever the log gained since the last look.
    // The first look, and a new game's shorter log, only set the baseline, so
    // joining mid-game is silent.
    let seen: number | null = null;
    effect(() => {
      const state = this.visibleState();
      const log = state?.log;
      if (!state || !log) return;
      untracked(() => {
        if (seen !== null && log.length > seen) {
          const fresh = log.slice(seen);
          for (const sound of [...soundsFor(fresh), ...deathSoundsFor(fresh, state)]) this.sounds.play(sound);
          for (const cue of voicesFor(fresh, state, this.gameService.registry)) this.sounds.playVoice(cue.gender, cue.voice);
        }
        seen = log.length;
      });
    });
    // A Compete popup for every Compete the log gains while the board is open
    // (same baseline rule as the sounds); several wait their turn.
    let competesSeen: number | null = null;
    effect(() => {
      const visible = this.visibleState();
      if (!visible) return;
      untracked(() => {
        const log = visible.log;
        if (competesSeen !== null && log.length > competesSeen) {
          this.competeQueue.push(...competeResults(log, competesSeen, visible.seats, visible.players));
          this.showNextCompete();
        }
        competesSeen = log.length;
      });
    });
    effect(() => {
      const count = this.discardsDue();
      untracked(() => {
        // Timed out (or otherwise settled): the open dialog has nothing left to ask.
        if (count === 0) this.closeDialog(this.discardDialog);
        else this.openDiscardDialog(count);
      });
    });
    effect(() => {
      const pendingId = this.responseDue();
      untracked(() => {
        if (this.responseDialogFor && this.responseDialogFor !== pendingId) this.closeDialog(this.responseDialog);
        if (pendingId) this.openResponseDialog(pendingId);
      });
    });
    effect(() => {
      const selectionId = this.selectionDue();
      untracked(() => {
        if (this.selectionDialogFor && this.selectionDialogFor !== selectionId) this.closeDialog(this.selectionDialog);
        if (selectionId) this.openSelectionDialog(selectionId);
      });
    });
    effect(() => {
      const arrangementId = this.arrangementDue();
      untracked(() => {
        if (this.arrangeDialogFor && this.arrangeDialogFor !== arrangementId) this.closeDialog(this.arrangeDialog);
        if (arrangementId) this.openArrangeDialog(arrangementId);
      });
    });
    effect(() => {
      const choiceId = this.choiceDue();
      untracked(() => {
        if (this.choiceDialogFor && this.choiceDialogFor !== choiceId) this.closeDialog(this.choiceDialog);
        if (choiceId) this.openChoiceDialog(choiceId);
      });
    });
  }

  protected readonly activeSeatId = this.gameService.activeSeatId;
  protected readonly visibleState = this.gameService.visibleState;
  protected readonly lastError = this.gameService.lastError;

  // Whose chair the table is seen from: the human in vs-bots, else the revealed active seat.
  protected readonly viewerSeatId = computed(() => this.gameService.humanSeatId() ?? this.activeSeatId());

  // The revealed seat's own hand, shown full-size below the table.
  protected readonly ownHand = computed<CardInstance[]>(() => {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    const seat = visible?.seats.find((s) => s.id === seatId);
    if (!visible || !seat) return [];
    return visible.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
  });

  // The viewer's active skills, as buttons on their avatar.
  protected readonly viewerSkills = computed(() => {
    const seat = this.visibleState()?.seats.find((s) => s.id === this.viewerSeatId());
    return seat ? avatarSkills(seat.generals, this.gameService.registry, this.gameService.legalActions(), extraSkillsOf(seat, this.gameService.registry)) : [];
  });

  // The viewer's force colour, which their decision dialogs are themed in.
  private readonly viewerForce = computed(() => forceOf(this.viewerSeat()?.kingdom));
  protected readonly viewerSeat = computed(() => this.visibleState()?.seats.find((s) => s.id === this.viewerSeatId()) ?? null);

  protected dyingOf(seat: Seat): boolean {
    const state = this.visibleState();
    return !!state && seatIsDying(state, seat);
  }

  protected zoneCards(zoneId: string): CardInstance[] {
    return this.visibleState()?.zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  // What each card in a zone counts as, when placed as another card (Country Scene's Capture).
  protected countsAsOf(zoneId: string): Record<string, string> {
    return this.visibleState()?.zones.find((z) => z.id === zoneId)?.countsAs ?? {};
  }

  protected readonly discardPile = computed(() => this.visibleState()?.zones.find((z) => z.kind === 'discardPile'));

  protected readonly actionHistory = computed(() => {
    const visible = this.visibleState();
    return visible ? actionHistory(visible.log, visible.zones, visible.players, visible.seats) : [];
  });

  protected readonly discardHistory = computed(() => {
    const visible = this.visibleState();
    const pile = this.discardPile();
    return visible && pile ? discardHistory(visible.log, pile.id) : [];
  });

  // The revealed seat's own dealt candidates (other seats' are redacted anyway).
  protected readonly selectionCandidates = computed<string[]>(() => {
    const visible = this.visibleState();
    const seatId = this.activeSeatId();
    if (!visible || !seatId) return [];
    return visible.generalSelection?.candidates[seatId] ?? [];
  });

  protected readonly generalChoices = computed<ChooseGeneralsAction[]>(() =>
    this.gameService.legalActions().filter((a): a is ChooseGeneralsAction => a.kind === 'ChooseGeneralsAction')
  );

  protected nameOf(seatId: string): string {
    return seatName(this.gameService.state()?.players ?? [], seatId);
  }

  private readonly competeQueue: CompeteResult[] = [];
  private competeDialog: MatDialogRef<CompeteDialog> | null = null;

  // Opens the next waiting Compete popup, themed in its source General's Force.
  private showNextCompete(): void {
    if (this.competeDialog) return;
    const next = this.competeQueue.shift();
    if (!next) return;
    const ref = openForceDialog<CompeteDialog, CompeteResult>(this.dialog, CompeteDialog, next.force, { data: next, width: 'min(92vw, 520px)', autoFocus: 'dialog' });
    this.competeDialog = ref;
    ref.afterClosed().subscribe(() => {
      this.competeDialog = null;
      this.showNextCompete();
    });
  }

  // The Discard phase in one step: the dialog returns exactly `count` cards,
  // each submitted as the engine's own legal DiscardCardAction.
  private openDiscardDialog(count: number): void {
    if (this.discardDialog) return;
    const hand = this.ownHand();
    // A timeout discards the ticked cards, topped up from the start of the hand.
    const timeoutChoice = (ticked: string[]) => {
      const fill = hand.map((c) => c.instanceId).filter((id) => !ticked.includes(id));
      const ids = [...ticked, ...fill].slice(0, count);
      const legal = this.gameService.legalActions().filter((a): a is DiscardCardAction => a.kind === 'DiscardCardAction');
      this.timer.setTimeoutChoice(ids.map((id) => legal.find((a) => a.cardInstanceId === id)).filter((a): a is DiscardCardAction => !!a));
    };
    const ref = openForceDialog<DiscardDialog, DiscardDialogData, string[]>(this.dialog, DiscardDialog, this.viewerForce(), {
      data: { cards: hand, count, chosenChanged: timeoutChoice },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.discardDialog = ref;
    ref.beforeClosed().subscribe((ids) => {
      this.discardDialog = null;
      const legal = this.gameService.legalActions().filter((a): a is DiscardCardAction => a.kind === 'DiscardCardAction');
      const actions = (ids ?? []).map((id) => legal.find((a) => a.cardInstanceId === id)).filter((a): a is DiscardCardAction => !!a);
      if (actions.length > 0) this.gameService.submitAll(actions);
    });
  }

  // Opens the Response dialog for one response window; the chosen action
  // (a RespondAction, or the PassAction for No Response) is the engine's own.
  private openResponseDialog(pendingId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.responseDialogFor === pendingId || !visible || !seatId) return;
    const description = describeResponse(visible, seatId, (effect) => this.gameService.previewEffect(visible, effect));
    const legal = this.gameService.legalActions();
    const noResponse = legal.find((a) => a.kind === 'PassAction');
    if (!description || !noResponse) return;
    const hand = this.ownHand();
    const cards: ResponseOption[] = legal.flatMap((action) => {
      if (action.kind !== 'RespondAction') return [];
      const card = hand.find((c) => c.instanceId === action.cardInstanceId);
      return card ? [{ id: card.instanceId, action, card, label: ResponseDialog.cardLabel(card) }] : [];
    });
    const skills: ResponseOption[] = legal.flatMap((action, i) =>
      action.kind === 'UseConversionAction' ? [{ id: `convert-${i}`, action, label: conversionLabel(action, visible, this.gameService.registry) }] : []
    );
    this.responseDialogFor = pendingId;
    const ref = openForceDialog<ResponseDialog, ResponseDialogData, Action>(this.dialog, ResponseDialog, this.viewerForce(), {
      data: { description, cards, skills, noResponse, startOnNoResponse: startsOnNoResponse(visible) },
      width: 'min(92vw, 520px)',
      disableClose: true,
    });
    this.responseDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.responseDialogFor = null;
      this.responseDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Choice dialog (Steal, Break, Harvest) for one pending choice;
  // the picked action is the engine's own ChooseOptionAction.
  private openChoiceDialog(choiceId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    const choice = visible?.pendingChoice;
    if (this.choiceDialogFor === choiceId || !visible || !choice || !seatId) return;
    // A "may": the Ask window instead.
    const ask = describeAsk(visible, seatId, this.gameService.legalActions());
    if (ask) {
      this.choiceDialogFor = choiceId;
      const ref = openForceDialog<AskDialog, AskDialogData, Action>(this.dialog, AskDialog, this.viewerForce(), { data: { description: ask }, width: 'min(92vw, 480px)', disableClose: true });
      this.choiceDialog = ref;
      ref.beforeClosed().subscribe((action) => {
        this.choiceDialogFor = null;
        this.choiceDialog = null;
        if (action) this.submit(action);
      });
      return;
    }
    const description = describeChoice(visible, seatId);
    if (!description) return;
    const options = choiceDialogOptions(choice.options, this.gameService.legalActions(), visible.players, description.declineLabel, visible.seats);
    this.choiceDialogFor = choiceId;
    const ref = openForceDialog<ChoiceDialog, ChoiceDialogData, Action>(this.dialog, ChoiceDialog, this.viewerForce(), {
      data: { description, options, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.choiceDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.choiceDialogFor = null;
      this.choiceDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Selection dialog for one pending selection; it closes with the
  // engine's SelectAction (ids filled) or its CancelSelectionAction.
  private openSelectionDialog(selectionId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.selectionDialogFor === selectionId || !visible || !seatId) return;
    const description = describeSelection(visible, seatId, this.gameService.legalActions());
    if (!description) return;
    this.selectionDialogFor = selectionId;
    const ref = openForceDialog<SelectionDialog, SelectionDialogData, Action>(this.dialog, SelectionDialog, this.viewerForce(), {
      data: { description, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.selectionDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.selectionDialogFor = null;
      this.selectionDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Arrange dialog for one pending arrangement; it closes with the
  // engine's ArrangeCardsAction filled in.
  private openArrangeDialog(arrangementId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.arrangeDialogFor === arrangementId || !visible || !seatId) return;
    const description = describeArrangement(visible, seatId, this.gameService.legalActions());
    if (!description) return;
    this.arrangeDialogFor = arrangementId;
    const ref = openForceDialog<ArrangeDialog, ArrangeDialogData, Action>(this.dialog, ArrangeDialog, this.viewerForce(), {
      data: { description, arrangedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 720px)',
      disableClose: true,
    });
    this.arrangeDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.arrangeDialogFor = null;
      this.arrangeDialog = null;
      if (action) this.submit(action);
    });
  }

  // Closes a dialog without an answer (its decision has already been made).
  private closeDialog(ref: MatDialogRef<unknown, unknown> | null): void {
    ref?.close(undefined);
  }

  submit(action: Action): void {
    this.gameService.submit(action);
  }

  dismissError(): void {
    this.gameService.clearError();
  }

  goToSetup(): void {
    this.router.navigateByUrl('/setup');
  }
}
