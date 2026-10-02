import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Action, CardInstance, ChooseGeneralsAction } from 'engine';
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { EventLog } from './event-log';
import { RoundTable } from './round-table';
import { HandView } from './hand-view';
import { GameOver } from './game-over';
import { GeneralSelection, SelectionProgress } from './general-selection';
import { PhaseIndicator } from './phase-indicator';

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, EventLog, PhaseIndicator, RoundTable, HandView, GameOver, GeneralSelection, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    @if (lastError(); as error) {
      <div class="error-banner" role="alert">
        <mat-icon>error</mat-icon>
        <span class="message">{{ error }}</span>
        @if (gameService.mode() === 'vs-bots' && gameService.state() && !gameService.state()!.result) {
          <!-- A failed bot move stops the bots, so give the player a way out. -->
          <button mat-button type="button" (click)="goToSetup()">New game</button>
        }
        <button mat-button type="button" (click)="dismissError()">Dismiss</button>
      </div>
    }

    @if (gameService.state(); as state) {
      @if (state.result; as result) {
        <app-game-over [result]="result" (newGame)="goToSetup()" />
      } @else if (activeSeatId(); as activeSeatId) {
        @if (gameService.humanSeatId() === null && gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [seatId]="activeSeatId" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection' && activeSeatId !== viewerSeatId()) {
            <mat-card appearance="outlined" class="bots-choosing">
              <mat-progress-spinner mode="indeterminate" diameter="28" />
              <span>Bots are choosing their generals…</span>
            </mat-card>
          } @else if (visible.phase === 'GeneralSelection') {
            <app-general-selection
              [candidates]="selectionCandidates()"
              [actions]="generalChoices()"
              [registry]="gameService.registry"
              [seatId]="activeSeatId"
              [progress]="selectionProgress()"
              (chosen)="submit($event)"
            />
          } @else {
            <app-phase-indicator [state]="visible" [viewerSeatId]="viewerSeatId()" />
            <app-round-table [state]="visible" [viewerSeatId]="viewerSeatId()!" [thinkingSeatId]="gameService.botThinkingSeatId()" [botSeatIds]="gameService.botSeatIds()" />
            <section class="your-hand">
              <h3>Your hand</h3>
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
            <app-event-log [events]="visible.log" />
          }
        }
      }
    } @else {
      <p>No game in progress.</p>
      <a mat-flat-button routerLink="/setup">Start a new game</a>
    }
  `,
  styles: `
    .error-banner {
      display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 8px 12px; border-radius: 12px;
      background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container);
    }
    .error-banner .message { flex: 1; }
    .bots-choosing { display: flex; align-items: center; gap: 16px; padding: 24px; margin: 24px auto; max-width: 420px; }
    .your-hand { margin: 8px 0; }
    .your-hand h3 { margin: 0 0 4px; }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);

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
    return (visible?.seats ?? []).map((s) => ({ seatId: s.id, done: !Object.prototype.hasOwnProperty.call(pending, s.id) }));
  });

  protected readonly generalChoices = computed<ChooseGeneralsAction[]>(() =>
    this.gameService.legalActions().filter((a): a is ChooseGeneralsAction => a.kind === 'ChooseGeneralsAction')
  );

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
