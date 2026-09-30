import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Action, CardInstance, ChooseGeneralsAction } from 'engine';
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { EventLog } from './event-log';
import { SeatSummary } from './seat-summary';
import { GameOver } from './game-over';
import { GeneralSelection } from './general-selection';

interface SeatViewModel {
  seat: import('engine').Seat;
  hand: CardInstance[];
}

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, EventLog, SeatSummary, GameOver, GeneralSelection, RouterLink],
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
            <div class="seats">
              @for (vm of seatViewModels(); track vm.seat.id) {
                <app-seat-summary [seat]="vm.seat" [hand]="vm.hand" />
              }
            </div>
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
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly activeSeatId = this.gameService.activeSeatId;
  protected readonly visibleState = this.gameService.visibleState;
  protected readonly lastError = this.gameService.lastError;

  protected readonly seatViewModels = computed<SeatViewModel[]>(() => {
    const state = this.visibleState();
    if (!state) return [];
    return state.seats.map((seat) => ({
      seat,
      hand: state.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [],
    }));
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
