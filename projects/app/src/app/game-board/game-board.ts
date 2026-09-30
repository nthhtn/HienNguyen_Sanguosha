import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Action, CardInstance, ChooseGeneralsAction } from 'engine';
import { GameService } from '../game.service';
import { cardIdDisplayName } from '../labels';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { EventLog } from './event-log';
import { RoundTable } from './round-table';
import { CardArt } from './card-art';
import { GameOver } from './game-over';
import { GeneralSelection } from './general-selection';

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, EventLog, RoundTable, CardArt, GameOver, GeneralSelection, RouterLink],
  template: `
    @if (lastError(); as error) {
      <div class="error-banner">
        {{ error }}
        <button (click)="dismissError()">Dismiss</button>
      </div>
    }

    @if (gameService.state(); as state) {
      @if (state.result; as result) {
        <app-game-over [result]="result" (newGame)="goToSetup()" />
      } @else if (activeSeatId(); as activeSeatId) {
        @if (gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [seatId]="activeSeatId" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection') {
            <app-general-selection
              [candidates]="selectionCandidates()"
              [actions]="generalChoices()"
              [registry]="gameService.registry"
              (chosen)="submit($event)"
            />
          } @else {
            <app-round-table [state]="visible" [viewerSeatId]="activeSeatId" />
            <section class="your-hand">
              <h3>Your hand</h3>
              <div class="cards">
                @for (card of ownHand(); track card.instanceId) {
                  <app-card-art [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
                } @empty {
                  <span>No cards</span>
                }
              </div>
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
      <a routerLink="/setup">Start a new game</a>
    }
  `,
  styles: `
    .your-hand { margin: 8px 0; }
    .your-hand h3 { margin: 0 0 4px; }
    .your-hand .cards { display: flex; gap: 6px; flex-wrap: wrap; }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly activeSeatId = this.gameService.activeSeatId;
  protected readonly visibleState = this.gameService.visibleState;
  protected readonly lastError = this.gameService.lastError;

  // The revealed seat's own hand, shown full-size below the table.
  protected readonly ownHand = computed<CardInstance[]>(() => {
    const visible = this.visibleState();
    const seatId = this.activeSeatId();
    const seat = visible?.seats.find((s) => s.id === seatId);
    if (!visible || !seat) return [];
    return visible.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
  });

  protected readonly cardIdDisplayName = cardIdDisplayName;

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
