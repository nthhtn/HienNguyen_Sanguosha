import { Component, DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Action, CardInstance, ChooseGeneralsAction, cardsOverHandLimit } from 'engine';

type DiscardCardAction = Extract<Action, { kind: 'DiscardCardAction' }>;
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { RoundTable } from './round-table';
import { HandView } from './hand-view';
import { GameOver } from './game-over';
import { GeneralSelection, SelectionProgress } from './general-selection';
import { PhaseIndicator } from './phase-indicator';
import { DiscardPile } from './discard-pile';
import { seatName } from '../labels';
import { discardHistory } from './discard-history';
import { ActionHistoryPanel } from './action-history-panel';
import { actionHistory } from './action-history';
import { DiscardDialog, DiscardDialogData } from './discard-dialog';
import { ResponseDialog, ResponseDialogData, ResponseOption } from './response-dialog';
import { describeResponse, startsOnNoResponse } from './response-description';
import { ChoiceDialog, ChoiceDialogData, ChoiceDialogOption } from './choice-dialog';
import { choiceOptionLabel, describeChoice } from './choice-description';
import { DecisionTimer } from '../decision-timer.service';

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, PhaseIndicator, RoundTable, HandView, GameOver, GeneralSelection, DiscardPile, ActionHistoryPanel, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatProgressSpinnerModule],
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
              [progress]="selectionProgress()"
              (chosen)="submit($event)"
            />
          } @else {
            <app-phase-indicator [state]="visible" [viewerSeatId]="viewerSeatId()" />
            <div class="table-row">
              <app-round-table [state]="visible" [viewerSeatId]="viewerSeatId()!" [thinkingSeatId]="gameService.botThinkingSeatId()" [botSeatIds]="gameService.botSeatIds()" />
              <aside class="side">
                <app-discard-pile [cards]="discardPile()?.cards ?? []" [history]="discardHistory()" />
                <app-action-history [history]="actionHistory()" />
              </aside>
            </div>
            <section class="your-hand">
              <h3>Your Hand</h3>
              <app-hand-view
                [cards]="ownHand()"
                [actions]="gameService.legalActions()"
                [state]="visible"
                [registry]="gameService.registry"
                (play)="submit($event)"
              />
            </section>
            <app-action-list
              [actions]="gameService.legalActions()"
              [state]="visible"
              [registry]="gameService.registry"
              (actionChosen)="submit($event)"
            />
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
    /* The discard pile and the action history get their own column off the
       table, to its right; on narrow screens they drop below, side by side. */
    .table-row { display: flex; align-items: center; gap: 16px; }
    .table-row app-round-table { flex: 1; min-width: 0; }
    .side { flex: none; width: 150px; display: flex; flex-direction: column; gap: 12px; }
    @media (max-width: 600px) {
      .table-row { flex-direction: column; align-items: stretch; gap: 0; }
      .side { width: auto; flex-direction: row; justify-content: center; align-items: flex-start; }
      .side > * { flex: 0 1 150px; }
    }
    .your-hand { margin: 8px 0; }
    .your-hand h3 { margin: 0 0 4px; }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly timer = inject(DecisionTimer);
  private discardDialog: MatDialogRef<DiscardDialog, string[]> | null = null;
  private responseDialog: MatDialogRef<ResponseDialog, Action> | null = null;
  private choiceDialog: MatDialogRef<ChoiceDialog, Action> | null = null;
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
    return cardsOverHandLimit(visible, seatId);
  });

  constructor() {
    // Decisions are timed only while the board is on screen.
    this.timer.attach(inject(DestroyRef));
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

  // A seat has chosen once its candidate entry is gone from the selection state.
  protected readonly selectionProgress = computed<SelectionProgress[]>(() => {
    const visible = this.visibleState();
    const pending = visible?.generalSelection?.candidates ?? {};
    return (visible?.seats ?? []).map((s) => ({ seatId: s.id, name: this.nameOf(s.id), done: !Object.prototype.hasOwnProperty.call(pending, s.id) }));
  });

  protected readonly generalChoices = computed<ChooseGeneralsAction[]>(() =>
    this.gameService.legalActions().filter((a): a is ChooseGeneralsAction => a.kind === 'ChooseGeneralsAction')
  );

  protected nameOf(seatId: string): string {
    return seatName(this.gameService.state()?.players ?? [], seatId);
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
    const ref = this.dialog.open<DiscardDialog, DiscardDialogData, string[]>(DiscardDialog, {
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
    const description = describeResponse(visible, seatId);
    const legal = this.gameService.legalActions();
    const noResponse = legal.find((a) => a.kind === 'PassAction');
    if (!description || !noResponse) return;
    const hand = this.ownHand();
    const cards: ResponseOption[] = legal.flatMap((action) => {
      if (action.kind !== 'RespondAction') return [];
      const card = hand.find((c) => c.instanceId === action.cardInstanceId);
      return card ? [{ id: card.instanceId, action, card, label: ResponseDialog.cardLabel(card) }] : [];
    });
    this.responseDialogFor = pendingId;
    const ref = this.dialog.open<ResponseDialog, ResponseDialogData, Action>(ResponseDialog, {
      data: { description, cards, skills: [], noResponse, startOnNoResponse: startsOnNoResponse(visible) },
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
    const description = describeChoice(visible, seatId);
    if (!description) return;
    const legal = this.gameService.legalActions();
    const options: ChoiceDialogOption[] = choice.options.flatMap((option) => {
      const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
      if (!action) return [];
      const shown = option.shows.kind === 'card' ? { card: option.shows.card } : { hiddenCount: option.shows.count };
      return [{ id: option.id, action, ...shown, label: choiceOptionLabel(option.shows, visible.players) }];
    });
    this.choiceDialogFor = choiceId;
    const ref = this.dialog.open<ChoiceDialog, ChoiceDialogData, Action>(ChoiceDialog, {
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
