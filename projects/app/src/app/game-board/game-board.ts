import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Action } from 'engine';
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { EventLog } from './event-log';
import { SeatSummary } from './seat-summary';
import { GameOver } from './game-over';

interface SeatViewModel {
  seat: import('engine').Seat;
  handCount: number;
}

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, EventLog, SeatSummary, GameOver],
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
          <div class="seats">
            @for (vm of seatViewModels(); track vm.seat.id) {
              <app-seat-summary [seat]="vm.seat" [handCount]="vm.handCount" />
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
      handCount: state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0,
    }));
  });

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
