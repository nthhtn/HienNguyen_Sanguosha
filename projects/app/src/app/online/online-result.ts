import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameResult } from 'engine';
import { GAME_OUTCOME_MESSAGES } from 'protocol';
import type { LastGame } from 'protocol';
import { forceOf, kingdomDisplayName } from '../labels';

// How the room's last game ended, named by the seats it was played with. An
// open room goes back to its lobby; a solo room offers Play Again or Back to Rooms.
@Component({
  selector: 'app-online-result',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card result" appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ ending().outcome === 'finished' ? 'Game Over' : 'Game Stopped' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (ending().result; as result) {
            <p class="headline" [attr.data-force]="result.winningKingdom ? forceOf(result.winningKingdom) : null">{{ headline(result) }}</p>
            <p class="winners">Winners: {{ names(result.winningSeatIds) || 'None' }}</p>
            <p class="losers">Losers: {{ names(result.losingSeatIds) || 'None' }}</p>
          } @else {
            <p class="banner stopped" role="alert">{{ stopped() }}</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          @if (solo()) {
            <button mat-button type="button" class="back-to-rooms" [disabled]="!canAct()" (click)="backToRooms.emit()">Back to Rooms</button>
            <button mat-flat-button type="button" class="play-again" [disabled]="!canAct()" (click)="playAgain.emit()"><mat-icon>replay</mat-icon> Play Again</button>
          } @else {
            <button mat-flat-button type="button" class="back-to-lobby" (click)="backToLobby.emit()">Back to Lobby</button>
          }
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class OnlineResult {
  readonly ending = input.required<LastGame>();
  readonly solo = input(false);
  readonly canAct = input(true);
  readonly backToLobby = output<void>();
  readonly playAgain = output<void>();
  readonly backToRooms = output<void>();
  protected readonly forceOf = forceOf;

  protected readonly stopped = computed(() => {
    const outcome = this.ending().outcome;
    return outcome === 'finished' ? '' : GAME_OUTCOME_MESSAGES[outcome];
  });

  protected names(seatIds: string[]): string {
    return seatIds.map((id) => this.ending().seats.find((s) => s.seatId === id)?.name ?? id).join(', ');
  }

  protected headline(result: GameResult): string {
    if (result.winningKingdom) return `${kingdomDisplayName(result.winningKingdom)} wins!`;
    if (result.winningSeatIds.length > 0) return `${this.names(result.winningSeatIds)} wins!`;
    return 'Draw — No survivors.';
  }
}
